import { shuffle } from "@s2h/utils/array";
import { generateBotInfo } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import { DurableObject } from "cloudflare:workers";
import type {
	BasePlayerInfo,
	CardLevel,
	Cost,
	CreateGameInput,
	GameData,
	Gem,
	PickTokensInput,
	PlayerGameInfo,
	PlayerId,
	PurchaseCardInput,
	ReserveCardInput
} from "./types.ts";
import { DEFAULT_TOKENS, generateDecks, generateNobles, getDefaultGameData } from "./utils.ts";

type CloudflareEnv = {
	SPLENDOR_KV: KVNamespace;
	WSS: DurableObjectNamespace<import("../../../../apps/web/src/wss.ts").WebsocketServer>;
}

export class SplendorEngine extends DurableObject<CloudflareEnv> {

	private readonly logger = createLogger( "Splendor:Engine" );
	private readonly key: string;
	private data: GameData;

	constructor( ctx: DurableObjectState, env: CloudflareEnv ) {
		super( ctx, env );
		this.key = ctx.id.toString();
		this.data = getDefaultGameData();

		ctx.blockConcurrencyWhile( async () => {
			const data = await this.loadGameData();
			if ( data ) {
				this.data = data;
			} else {
				this.logger.info( "No existing game data found, starting new game." );
				await this.saveGameData();
			}
		} );
	}

	public async getPlayerData( playerId: PlayerId ) {
		if ( !this.data.players[ playerId ] ) {
			this.logger.error( "Player %s is not part of the game! GameId: %s", playerId, this.data.id );
			return { error: `Player ${ playerId } is not part of the game!` };
		}

		const { decks, ...rest } = this.data;
		return { data: { ...rest, playerId } };
	}

	public async initialize( { playerCount }: Partial<CreateGameInput>, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> initialize()" );

		const { error } = this.validateInitialization();
		if ( error ) {
			this.logger.error( "Game initialization failed:", error );
			return { error };
		}

		this.data.createdBy = playerInfo.id;
		this.data.decks = generateDecks();
		this.logger.debug( " Generated decks: %o", this.data.decks );

		this.data.currentTurn = playerInfo.id;
		this.data.playerCount = playerCount ?? this.data.playerCount;

		this.data.nobles = generateNobles( this.data.playerCount );
		this.logger.debug( " Generated nobles: %o", this.data.nobles );

		switch ( playerCount ) {
			case 2:
				this.data.tokens = { diamond: 3, sapphire: 3, emerald: 3, ruby: 3, onyx: 3, gold: 5 };
				break;
			case 3:
				this.data.tokens = { diamond: 5, sapphire: 5, emerald: 5, ruby: 5, onyx: 5, gold: 5 };
				break;
			case 4:
				this.data.tokens = { diamond: 7, sapphire: 7, emerald: 7, ruby: 7, onyx: 7, gold: 5 };
				break;
		}

		await this.addPlayer( playerInfo );
		await this.saveDurableObjectId();

		this.logger.debug( "<< initialize()" );
		return { data: this.data.id };
	}

	public async addPlayer( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> addPlayer()" );

		if ( this.data.players[ playerInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", playerInfo.id );
			return { data: this.data.id };
		}

		const { error } = this.validateAddPlayer();
		if ( error ) {
			this.logger.error( "Player addition failed:", error );
			return { error };
		}

		this.data.players[ playerInfo.id ] = {
			...playerInfo,
			tokens: DEFAULT_TOKENS,
			cards: [],
			nobles: [],
			reserved: [],
			points: 0,
			isBot: false
		};

		this.data.playerOrder.push( playerInfo.id );
		if ( this.data.playerOrder.length === this.data.playerCount ) {
			this.data.status = "PLAYERS_READY";
		}

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< addPlayer()" );
		return {};
	}

	public async addBots( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> addBots()" );

		if ( this.data.createdBy !== playerInfo.id ) {
			this.logger.error( "Only the game creator can add bots! GameId: %s", this.data.id );
			return { error: "Only the game creator can add bots!" };
		}

		const { error } = this.validateAddPlayer();
		if ( error ) {
			this.logger.error( "Bot addition failed:", error );
			return { error };
		}

		const botsToAdd = this.data.playerCount - this.data.playerOrder.length;
		for ( let i = 0; i < botsToAdd; i++ ) {
			const botInfo = generateBotInfo();
			this.data.playerOrder.push( botInfo.id );
			this.data.players[ botInfo.id ] = {
				...botInfo,
				cards: [],
				nobles: [],
				points: 0,
				reserved: [],
				tokens: DEFAULT_TOKENS,
				isBot: true
			};
		}

		this.data.status = "PLAYERS_READY";

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< addBots()" );
		return {};
	}

	public async startGame( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> startGame()" );

		const { error } = this.validateStartGame( playerInfo );
		if ( error ) {
			this.logger.error( "Failed to start game: %o", error );
			return { error };
		}

		this.data.playerOrder = shuffle( this.data.playerOrder );
		this.data.status = "IN_PROGRESS";
		this.data.cards = {
			1: this.data.decks[ 1 ].splice( 0, 4 ),
			2: this.data.decks[ 2 ].splice( 0, 4 ),
			3: this.data.decks[ 3 ].splice( 0, 4 )
		};

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< startGame()" );
		return {};
	}

	public async pickTokens( input: PickTokensInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> handlePickTokens()" );

		const { error } = this.validatePickTokens( input, playerInfo );
		if ( error ) {
			this.logger.error( "Failed to pick tokens: %o", error );
			return { error };
		}

		input.tokens.forEach( gem => {
			this.data.players[ playerInfo.id ].tokens[ gem ] += 1;
			this.data.tokens[ gem ] -= 1;
		} );

		this.updateTurn();
		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< handlePickTokens()" );
		return {};
	}

	public async reserveCard( input: ReserveCardInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> reserveCard()" );

		const { card, error } = this.validateReserveCard( input, playerInfo );
		if ( error || !card ) {
			this.logger.error( "Failed to reserve card: %o", error );
			return { error };
		}

		this.data.players[ playerInfo.id ].reserved.push( card );
		const cardIdx = this.data.cards[ card.level ].findIndex( c => c?.id === card.id );
		this.data.cards[ card.level ][ cardIdx ] = this.data.decks[ card.level ].shift();

		if ( input.withGold ) {
			this.data.players[ playerInfo.id ].tokens.gold += 1;
			this.data.tokens.gold -= 1;
		}

		this.updateTurn();
		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< reserveCard()" );
		return {};
	}

	public async purchaseCard( input: PurchaseCardInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> purchaseCard()" );

		const { card, fromReserved, error } = this.validatePurchaseCard( input, playerInfo );
		if ( error || !card ) {
			this.logger.error( "Failed to purchase card: %o", error );
			return { error };
		}

		if ( fromReserved ) {
			const cardIdx = this.data.players[ playerInfo.id ].reserved.findIndex( c => c.id === card.id );
			this.data.players[ playerInfo.id ].cards.push( card );
			this.data.players[ playerInfo.id ].reserved.splice( cardIdx, 1 );
		} else {
			const cardIdx = this.data.cards[ card.level ].findIndex( c => c && c.id === card.id );
			this.data.players[ playerInfo.id ].cards.push( card );
			this.data.cards[ card.level ][ cardIdx ] = this.data.decks[ card.level ].shift();
		}

		const player = this.data.players[ playerInfo.id ];
		Object.keys( input.payment ).forEach( key => {
			const gem = key as keyof typeof input.payment;
			player.tokens[ gem ] -= input.payment[ gem ]!;
			this.data.tokens[ gem ] += input.payment[ gem ]!;
		} );

		this.updateTurn();
		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< purchaseCard()" );
		return {};
	}

	private validateInitialization() {
		this.logger.debug( ">> validateInitialization()" );

		if ( this.data.status !== "CREATED" ) {
			this.logger.error( "Game has already been initialized!" );
			return { error: "Game has already been initialized!" };
		}

		if ( this.data.playerOrder.length > 0 ) {
			this.logger.error( "Cannot initialize a game that already has players!" );
			return { error: "Cannot initialize a game that already has players!" };
		}

		this.logger.debug( "<< validateInitialization()" );
		return {};
	}

	private validateAddPlayer() {
		this.logger.debug( ">> validateJoinGame()" );

		if ( this.data.playerOrder.length >= this.data.playerCount ) {
			this.logger.error( "Game Full: %s", this.data.id );
			return { error: "Game full!" };
		}

		this.logger.debug( "<< validateJoinGame()" );
		return {};
	}

	private validateStartGame( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validateStartGame()" );

		if ( this.data.createdBy !== playerInfo.id ) {
			this.logger.error( "Only the game creator can start game! GameId: %s", this.data.id );
			return { error: "Only the game creator can create teams!" };
		}

		if ( this.data.status !== "PLAYERS_READY" ) {
			this.logger.error( "Game already started: %s", this.data.id );
			return { error: "Game already started!" };
		}

		if ( this.data.playerOrder.length != this.data.playerCount ) {
			this.logger.error( "Not enough players to start the game: %s", this.data.id );
			return { error: "Not enough players to start the game!" };
		}

		this.logger.debug( "<< validateStartGame()" );
		return {};
	}

	private validatePickTokens( input: PickTokensInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validatePickTokens()" );

		// 1. Check if it's the player's turn
		if ( this.data.currentTurn !== playerInfo.id ) {
			this.logger.error( "Not player's turn: %s", playerInfo.id );
			return { error: "Not your turn!" };
		}

		// 2. Check if the tokens requested are valid (either 2 of the same gem or 3 different gems)
		const tokenCounts: Record<Gem, number> = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 };
		input.tokens.forEach( gem => {
			tokenCounts[ gem ] += 1;
		} );

		const uniqueGems = Object.values( tokenCounts ).filter( count => count > 0 ).length;
		if ( uniqueGems === 1 ) {
			// Picking 2 of the same gem
			const gem = input.tokens[ 0 ];
			if ( tokenCounts[ gem ] !== 2 ) {
				this.logger.error( "Invalid token pick: %o", input.tokens );
				return { error: "Invalid token pick!" };
			}

			if ( this.data.tokens[ gem ] < 4 ) {
				this.logger.error( "Not enough tokens of gem %s available", gem );
				return { error: `Not enough tokens of ${ gem } available!` };
			}
		} else if ( uniqueGems === 3 ) {
			// Picking 3 different gems
			if ( input.tokens.length !== 3 || new Set( input.tokens ).size !== 3 ) {
				this.logger.error( "Invalid token pick: %o", input.tokens );
				return { error: "Invalid token pick!" };
			}

			for ( const gem of input.tokens ) {
				if ( this.data.tokens[ gem ] < 1 ) {
					this.logger.error( "Not enough tokens of gem %s available", gem );
					return { error: `Not enough tokens of ${ gem } available!` };
				}
			}

		} else {
			this.logger.error( "Invalid token pick: %o", input.tokens );
			return { error: "Invalid token pick!" };
		}

		this.logger.debug( "<< validatePickTokens()" );
		return {};
	}

	private validateReserveCard( input: ReserveCardInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validateReserveCard()" );

		const player = this.data.players[ playerInfo.id ];

		// 1. Check if it's the player's turn
		if ( this.data.currentTurn !== playerInfo.id ) {
			this.logger.error( "Not player's turn: %s", playerInfo.id );
			return { error: "Not your turn!" };
		}

		// 2. Check if the player can reserve more cards
		if ( player.reserved.length >= 3 ) {
			this.logger.error( "Player has too many reserved cards: %s", playerInfo.id );
			return { error: "You cannot reserve more than 3 cards!" };
		}

		// 3. Check if the card exists in the open cards
		const card = this.findCardInOpenCards( input.cardId );
		if ( !card ) {
			this.logger.error( "Card to reserve not found: %s", input.cardId );
			return { error: "Card not found!" };
		}

		// 4. Check if the player can take a gold token if requested
		if ( input.withGold && this.data.tokens.gold < 1 ) {
			this.logger.error( "Not enough gold tokens available to reserve with gold" );
			return { error: "Not enough gold tokens available!" };
		}

		// %. Check if player can take gold token without exceeding token limit
		const totalTokens = Object.values( player.tokens ).reduce( ( acc, val ) => acc + val, 0 );
		if ( input.withGold && totalTokens >= 10 ) {
			this.logger.error( "Player cannot take gold token without exceeding token limit: %s", playerInfo.id );
			return { error: "You cannot take a gold token without exceeding the token limit!" };
		}

		this.logger.debug( "<< validateReserveCard()" );
		return { card };
	}

	private validatePurchaseCard( input: PurchaseCardInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validatePurchaseCard()" );

		// 1. Check if it's the player's turn
		if ( this.data.currentTurn !== playerInfo.id ) {
			this.logger.error( "Not player's turn: %s", playerInfo.id );
			return { error: "Not your turn!" };
		}

		// 2. Check if the card exists either in open cards or reserved cards
		let fromReserved = false;
		let card = this.findCardInOpenCards( input.cardId );
		if ( !card ) {
			card = this.findCardInReserved( input.cardId, playerInfo.id );
			if ( !card ) {
				this.logger.error( "Card to purchase not found: %s", input.cardId );
				return { error: "Card not found!" };
			} else {
				fromReserved = true;
			}
		}

		// 3. Calculate total cost after discounts from owned cards) and check if correct payment is provided
		const player = this.data.players[ playerInfo.id ];
		const totalCost: Cost = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };

		Object.keys( card.cost ).forEach( key => {
			const gem = key as keyof typeof card.cost;
			const discount = player.cards.filter( c => c.bonus === gem ).length;
			totalCost[ gem ] = Math.max( 0, card.cost[ gem ] - discount );
		} );

		const paymentCopy = { ...input.payment };
		let goldNeeded = 0;

		for ( const key of Object.keys( totalCost ) ) {
			const gem = key as keyof typeof totalCost;
			if ( ( paymentCopy[ gem ] ?? 0 ) > totalCost[ gem ] ) {
				this.logger.error(
					"Overpayment for gem %s: paid %d, needed %d",
					gem,
					paymentCopy[ gem ],
					totalCost[ gem ]
				);
				return { error: "Overpayment is not allowed!" };
			}
			const diff = totalCost[ gem ] - ( paymentCopy[ gem ] ?? 0 );
			if ( diff > 0 ) {
				goldNeeded += diff;
			}
			paymentCopy[ gem ] = 0;
		}

		if ( ( paymentCopy.gold ?? 0 ) < goldNeeded ) {
			this.logger.error(
				"Not enough gold tokens provided: needed %d, provided %d",
				goldNeeded,
				paymentCopy.gold
			);
			return { error: "Not enough gold tokens provided!" };
		}

		if ( ( paymentCopy.gold ?? 0 ) > goldNeeded ) {
			this.logger.error( "Overpayment with gold tokens: needed %d, provided %d", goldNeeded, paymentCopy.gold );
			return { error: "Overpayment is not allowed!" };
		}

		// 4. Check if player has enough tokens to cover the total cost
		for ( const key of Object.keys( totalCost ) ) {
			const gem = key as keyof typeof totalCost;
			if ( totalCost[ gem ] > player.tokens[ gem ] ) {
				this.logger.error(
					"Player does not have enough tokens of gem %s: has %d, trying to pay %d",
					gem,
					player.tokens[ gem ],
					totalCost[ gem ]
				);
				return { error: `You do not have enough ${ gem } tokens!` };
			}
		}

		this.logger.debug( "<< validatePurchaseCard()" );
		return { card, fromReserved };
	}

	private findCardInReserved( cardId: string, playerId: string ) {
		return this.data.players[ playerId ].reserved.find( card => card.id === cardId );
	}

	private findCardInOpenCards( cardId: string ) {
		for ( const level of [ 1, 2, 3 ] as CardLevel[] ) {
			const card = this.data.cards[ level ].find( card => card?.id === cardId );
			if ( card ) {
				return card;
			}
		}
		return undefined;
	}

	private updateTurn() {
		const currentIndex = this.data.playerOrder.indexOf( this.data.currentTurn );
		const nextIndex = ( currentIndex + 1 ) % this.data.playerOrder.length;
		this.data.currentTurn = this.data.playerOrder[ nextIndex ];
	}

	private getPlayerDataMap() {
		const { decks, ...rest } = this.data;
		return Object.keys( this.data.players ).reduce( ( acc, playerId ) => {
			acc[ playerId ] = { ...rest, playerId };
			return acc;
		}, {} as Record<string, PlayerGameInfo> );
	}

	private getNotificationMessage() {
		return "";
	}

	private async broadcastGameData() {
		this.logger.debug( ">> broadcast()" );

		const durableObjectId = this.env.WSS.idFromName( `splendor:${ this.data.id }` );
		const wss = this.env.WSS.get( durableObjectId );
		const notification = this.getNotificationMessage();
		await wss.broadcast( this.getPlayerDataMap(), notification );

		this.logger.debug( "<< broadcast()" );
	}

	private async loadGameData() {
		return this.env.SPLENDOR_KV.get<GameData>( this.key, "json" );
	}

	private async saveGameData() {
		await this.env.SPLENDOR_KV.put( this.key, JSON.stringify( this.data ) );
	}

	/**
	 * Persist durable object lookup keys (code and game id) into KV.
	 * Side effects:
	 * - Writes lookup mappings used by external lookup endpoints.
	 *
	 * @returns void
	 * @private
	 */
	private async saveDurableObjectId() {
		await this.env.SPLENDOR_KV.put( `code:${ this.data.code }`, this.key );
		await this.env.SPLENDOR_KV.put( `gameId:${ this.data.id }`, this.key );
	}
}