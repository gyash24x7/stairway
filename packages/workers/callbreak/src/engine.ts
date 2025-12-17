import { remove } from "@s2h/utils/array";
import { CARD_SUITS, type CardId, generateDeck, generateHands, getCardSuit } from "@s2h/utils/cards";
import { generateBotInfo, generateGameCode, generateId } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import { DurableObject } from "cloudflare:workers";
import type {
	BasePlayerInfo,
	Bindings,
	CreateGameInput,
	DealWithRounds,
	DeclareDealWinsInput,
	GameData,
	PlayCardInput,
	PlayerGameInfo,
	PlayerId,
	Round,
	StartedRound
} from "./types.ts";
import { getBestCardPlayed, getPlayableCards, suggestCardToPlay, suggestDealWins } from "./utils.ts";

/**
 * Durable Object that manages the authoritative Callbreak game state and logic.
 *
 * Responsibilities:
 * - Hold the canonical GameData for a single game instance.
 * - Accept player actions (join, declare wins, play cards), enforce rules, and progress the
 *   game through deals/rounds.
 * - Persist GameData to the CALLBREAK_KV namespace and broadcast player-facing views over WSS.
 *
 * Side effects:
 * - Many methods mutate `this.data`. Persist changes by calling saveGameData()
 *   (most public mutating methods do this internally).
 *
 * Notes:
 * - Constructed within a Durable Object runtime. Initial state is loaded during construction
 *   via ctx.blockConcurrencyWhile(...) to avoid races.
 *
 * @class CallbreakEngine
 * @public
 */
export class CallbreakEngine extends DurableObject<Bindings> {

	protected data: GameData;
	private readonly logger = createLogger( "Callbreak:Engine" );
	private readonly key: string;

	constructor( ctx: DurableObjectState, env: Bindings ) {
		super( ctx, env );
		this.key = ctx.id.toString();
		this.data = CallbreakEngine.defaultGameData();

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

	/**
	 * Create a new default GameData object.
	 * Side effects: none (pure factory). Caller should assign the returned object to this.data
	 * and persist it if desired.
	 *
	 * @returns New GameData object populated with deterministic defaults.
	 * @private
	 */
	private static defaultGameData() {
		return {
			id: generateId(),
			code: generateGameCode(),
			dealCount: 5 as const,
			trump: CARD_SUITS.HEARTS,
			currentTurn: "",
			status: "GAME_CREATED" as const,
			scores: {},
			createdBy: "",
			players: {},
			deals: []
		};
	}

	/**
	 * Return a player-safe snapshot of the current game state.
	 * This omits secret/internal-only details where appropriate and computes per-player views.
	 * No state mutation or persistence occurs.
	 *
	 * @param playerId ID of the requesting player.
	 * @returns Object containing either PlayerGameInfo or error message
	 * @public
	 */
	public async getPlayerData( playerId: PlayerId ) {
		this.logger.debug( ">> getPlayerData()" );
		const playerDataMap = this.getPlayerDataMap();

		if ( !playerDataMap[ playerId ] ) {
			this.logger.error( "Player Not in Game: %s", playerId );
			return { error: "Player not in game!" };
		}

		const data = playerDataMap[ playerId ];
		this.logger.debug( "<< getPlayerData()" );
		return { data };
	}

	/**
	 * Initialize or reconfigure a game instance.
	 *
	 * Behaviour / side effects:
	 * - Mutates this.data.createdBy, this.data.dealCount, this.data.trump, and this.data.currentTurn.
	 * - Persists changes to CALLBREAK_KV and stores mappings for lookup.
	 *
	 * Validation: This method assumes sensible input and will overwrite current configuration.
	 *
	 * @param input Parameters for game creation (dealCount, trumpSuit, etc).
	 * @param player Authentication/player metadata for the creating player.
	 * @returns Object with the game id.
	 * @public
	 */
	public async initialize( input: CreateGameInput, player: BasePlayerInfo ) {
		this.logger.debug( ">> initialize()" );

		this.data.dealCount = input.dealCount ?? this.data.dealCount;
		this.data.trump = input.trumpSuit;
		this.data.currentTurn = player.id;
		this.data.createdBy = player.id;

		await this.addPlayer( player );

		await this.saveGameData();
		await this.saveDurableObjectId();
		await this.broadcastGameData();

		this.logger.debug( "<< initialize()" );
		return { data: this.data.id };
	}

	/**
	 * Add a player to the game.
	 * Returns the game id if player successfully added or already present.
	 *
	 * Side effects:
	 * - Mutates this.data.players and this.data.scores.
	 * - Persists the updated GameData and broadcasts the updated player views.
	 *
	 * Validation:
	 * - Fails when the game is full.
	 *
	 * @param playerInfo Authentication/player metadata for the joining player.
	 * @returns Object with game id or error message.
	 * @public
	 */
	public async addPlayer( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> addPlayer()" );

		if ( this.data.players[ playerInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", playerInfo.id );
			return { data: this.data.id };
		}

		const { error } = this.validateJoinGame();
		if ( error ) {
			this.logger.error( "Cannot add player %s: %s", playerInfo.id, error );
			return { error };
		}

		this.data.players[ playerInfo.id ] = { ...playerInfo, isBot: false };
		this.data.scores[ playerInfo.id ] = [];

		if ( Object.keys( this.data.players ).length === 4 ) {
			this.data.status = "PLAYERS_READY";
		}

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< addPlayer()" );
		return { data: this.data.id };
	}

	/**
	 * Add bot players until the table has 4 players.
	 * Side effects:
	 * - Mutates this.data.players and this.data.scores and sets this.data.status to PLAYERS_READY.
	 *
	 * @public
	 */
	public async addBots( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> addBots()" );

		const { error } = this.validateAddBots( playerInfo );
		if ( error ) {
			this.logger.error( "Cannot add bots: %s", error );
			return { error };
		}

		const botCount = 4 - Object.keys( this.data.players ).length;
		for ( let i = 0; i < botCount; i++ ) {
			const botInfo = generateBotInfo();
			this.data.players[ botInfo.id ] = { ...botInfo, isBot: true };
			this.data.scores[ botInfo.id ] = [];
		}

		this.data.status = "PLAYERS_READY";

		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );

		this.logger.debug( "<< addBots()" );
		return {};
	}

	/**
	 * Declare expected wins for the active deal on behalf of authInfo.
	 *
	 * Behaviour / side effects:
	 * - Validates turn & deal, updates declarations and currentTurn, may change this.data.status.
	 * - Persists changes and triggers broadcasting and an alarm to progress the game.
	 *
	 * @param input Object containing dealId and wins declared.
	 * @param authInfo Authentication/player metadata for the declaring player.
	 * @returns Error message on validation failure or empty object on success.
	 * @public
	 */
	public async declareDealWins( input: DeclareDealWinsInput, authInfo: BasePlayerInfo ) {
		this.logger.debug( ">> declareDealWins()" );

		const { error } = this.validateDealWinDeclaration( input, authInfo );
		if ( error ) {
			this.logger.error( "Cannot declare wins for player %s: %s", authInfo.id, error );
			return { error };
		}

		let nonZeroDeclarations = Object.values( this.data.deals[ 0 ].declarations ).filter( v => v > 0 );
		if ( nonZeroDeclarations.length === 0 ) {
			this.data.deals[ 0 ].status = "IN_PROGRESS";
		}

		const nextPlayerIdx = ( this.data.deals[ 0 ].playerOrder.indexOf( this.data.currentTurn ) + 1 ) % 4;
		this.data.deals[ 0 ].declarations[ this.data.currentTurn ] = input.wins;
		this.data.currentTurn = this.data.deals[ 0 ].playerOrder[ nextPlayerIdx ];

		nonZeroDeclarations = Object.values( this.data.deals[ 0 ].declarations ).filter( v => v > 0 );
		if ( nonZeroDeclarations.length === 4 ) {
			this.data.status = "WINS_DECLARED";
		}

		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );

		this.logger.debug( "<< declareDealWins()" );
		return {};
	}

	/**
	 * Play a card for the current player in the active round.
	 *
	 * Behaviour / side effects:
	 * - Validates turn, deal, round, card ownership and playability.
	 * - Mutates round.cards, deal.hands, currentTurn and possibly this.data.status.
	 * - Persists changes and broadcasts player views; sets an alarm to continue progression.
	 *
	 * @param input Object containing gameId, dealId, roundId and cardId.
	 * @param authInfo Authentication/player metadata for the playing player.
	 * @returns Error message on validation failure or empty object on success.
	 * @public
	 */
	public async playCard( input: PlayCardInput, authInfo: BasePlayerInfo ) {
		this.logger.debug( ">> playCard()" );

		const { error } = this.validatePlayCard( input, authInfo );
		if ( error ) {
			this.logger.error( "Cannot play card for player %s: %s", authInfo.id, error );
			return { error };
		}

		const activeDeal = this.data.deals[ 0 ];
		const activeRound = activeDeal.rounds[ 0 ];
		const playerInfo = this.data.players[ this.data.currentTurn ];

		activeRound.cards[ playerInfo.id ] = input.cardId;
		if ( !activeRound.suit ) {
			activeRound.status = "IN_PROGRESS";
			activeRound.suit = getCardSuit( input.cardId );
		}

		activeDeal.rounds[ 0 ] = activeRound;
		activeDeal.hands[ playerInfo.id ] = remove(
			card => card === input.cardId,
			activeDeal.hands[ playerInfo.id ]
		);

		if ( Object.keys( activeRound.cards ).length === 4 ) {
			this.data.status = "CARDS_PLAYED";
		}

		const nextPlayerIdx = ( activeRound.playerOrder.indexOf( this.data.currentTurn ) + 1 ) % 4;
		this.data.currentTurn = activeRound.playerOrder[ nextPlayerIdx ];
		this.data.deals[ 0 ] = activeDeal;

		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );

		this.logger.debug( "<< playCard()" );
		return {};
	}

	/**
	 * Durable Object alarm handler that advances game state automatically.
	 *
	 * Behaviour:
	 * - Observes this.data.status and steps the game forward (add bots, create deal/round,
	 *   auto-declare wins/play cards for bots, complete rounds/deals/games).
	 *
	 * Side effects:
	 * - Mutates this.data and persists/broadcasts as needed.
	 *
	 * @public
	 * @override
	 */
	override async alarm() {
		this.logger.debug( ">> alarm()" );

		let setNextAlarm = false;
		switch ( this.data.status ) {
			case "PLAYERS_READY": {
				this.createDeal();
				setNextAlarm = true;
				break;
			}

			case "CARDS_DEALT": {
				const currentDeal = this.data.deals[ 0 ];
				const currentPlayer = this.data.players[ this.data.currentTurn ];
				if ( currentPlayer.isBot ) {
					const wins = suggestDealWins( currentDeal.hands[ currentPlayer.id ], this.data.trump );
					const input = { dealId: currentDeal.id, wins, gameId: this.data.id };
					await this.declareDealWins( input, currentPlayer );
					setNextAlarm = true;
				}
				break;
			}

			case "WINS_DECLARED": {
				this.createRound();
				setNextAlarm = true;
				break;
			}

			case "ROUND_STARTED": {
				const currentDeal = this.data.deals[ 0 ];
				const currentRound = currentDeal.rounds[ 0 ];
				const currentPlayer = this.data.players[ this.data.currentTurn ];

				const hand = currentDeal.hands[ currentPlayer.id ];
				const cardsOffTheGame = currentDeal.rounds.flatMap( round => Object.values( round.cards ) );

				if ( currentPlayer.isBot ) {
					const input: PlayCardInput = {
						gameId: this.data.id,
						dealId: currentDeal.id,
						roundId: currentRound.id,
						cardId: suggestCardToPlay( hand, this.data.trump, cardsOffTheGame, currentRound )
					};
					await this.playCard( input, currentPlayer );
					setNextAlarm = true;
				}
				break;
			}

			case "CARDS_PLAYED": {
				this.completeRound();
				setNextAlarm = true;
				break;
			}

			case "ROUND_COMPLETED": {
				const currentDeal = this.data.deals[ 0 ];
				if ( currentDeal.rounds.length === 13 ) {
					this.completeDeal();
				} else {
					this.createRound();
				}
				setNextAlarm = true;
				break;
			}

			case "DEAL_COMPLETED": {
				if ( this.data.deals.length < this.data.dealCount ) {
					this.createDeal();
					setNextAlarm = true;
				} else {
					await this.completeGame();
				}
				break;
			}
		}

		if ( setNextAlarm ) {
			await this.setAlarm( 5000 );
		}

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< alarm()" );
	}

	/**
	 * Produce a map of playerId -> PlayerGameInfo (player-facing view).
	 * Does not mutate state.
	 *
	 * @returns Key value map of playerId to PlayerGameInfo.
	 * @private
	 */
	private getPlayerDataMap(): Record<PlayerId, PlayerGameInfo> {
		return Object.keys( this.data.players ).reduce(
			( acc, playerId ) => {
				const { deals, players, ...rest } = this.data;
				if ( !deals[ 0 ] ) {
					acc[ playerId ] = { ...rest, playerId, hand: [], players };
					return acc;
				}

				const { rounds, hands, ...currentDeal } = deals[ 0 ];
				const hand = hands[ playerId ];
				const currentRound = rounds[ 0 ];
				acc[ playerId ] = { ...rest, playerId, currentDeal, currentRound, hand, players };

				return acc;
			},
			{} as Record<string, PlayerGameInfo>
		);
	}

	/**
	 * Create a new deal: shuffle & distribute cards and set up deal metadata.
	 * Side effects:
	 * - Mutates this.data.deals, this.data.currentTurn and this.data.status.
	 *
	 * @private
	 */
	private createDeal() {
		this.logger.debug( ">> createDeal()" );

		const deck = generateDeck();
		const hands = generateHands( deck, 4 );
		const playerIds = Object.keys( this.data.players ).toSorted();
		const playerOrder = this.data.deals.length === 0
			? [
				...playerIds.slice( playerIds.indexOf( this.data.createdBy ) ),
				...playerIds.slice( 0, playerIds.indexOf( this.data.createdBy ) )
			]
			: [ ...this.data.deals[ 0 ].playerOrder.slice( 1 ), this.data.deals[ 0 ].playerOrder[ 0 ] ];

		const deal: DealWithRounds = {
			id: generateId(),
			playerOrder,
			status: "CREATED",
			declarations: playerIds.reduce(
				( acc, playerId ) => {
					acc[ playerId ] = 0;
					return acc;
				},
				{} as DealWithRounds["declarations"]
			),
			wins: playerIds.reduce(
				( acc, playerId ) => {
					acc[ playerId ] = 0;
					return acc;
				},
				{} as DealWithRounds["wins"]
			),
			createdAt: Date.now(),
			rounds: [],
			hands: hands.reduce(
				( acc, value, index ) => {
					acc[ playerOrder[ index ] ] = value;
					return acc;
				},
				{} as Record<PlayerId, CardId[]>
			)
		};

		this.data.deals.unshift( deal );
		this.data.status = "CARDS_DEALT";
		this.data.currentTurn = deal.playerOrder[ 0 ];

		this.logger.debug( "<< createDeal()" );
	}

	/**
	 * Create a new round within the active deal and set the player order.
	 * Side effects:
	 * - Mutates active deal's rounds, this.data.currentTurn and this.data.status.
	 *
	 * @private
	 */
	private createRound() {
		this.logger.debug( ">> createRound()" );

		const activeDeal = this.data.deals[ 0 ];
		const lastRound = activeDeal.rounds[ 0 ];
		const playerOrder = !lastRound ? activeDeal.playerOrder : [
			...lastRound.playerOrder.slice( lastRound.playerOrder.indexOf( lastRound.winner! ) ),
			...lastRound.playerOrder.slice( 0, lastRound.playerOrder.indexOf( lastRound.winner! ) )
		];

		const round: Round = {
			id: generateId(),
			playerOrder,
			status: "CREATED",
			cards: {},
			createdAt: Date.now()
		};

		activeDeal.rounds.unshift( round );
		this.data.deals[ 0 ] = activeDeal;
		this.data.currentTurn = playerOrder[ 0 ];
		this.data.status = "ROUND_STARTED";

		this.logger.debug( "<< createRound()" );
	}

	/**
	 * Complete the active round by selecting the winner and updating wins.
	 *
	 * Behaviour:
	 * - Determines winning card/player based on trump & suit and increments win counters.
	 *
	 * Side effects:
	 * - Mutates the active round and active deal structures and sets this.data.status.
	 *
	 * @private
	 */
	private completeRound() {
		this.logger.debug( ">> completeRound()" );

		const activeDeal = this.data.deals[ 0 ];
		const activeRound = activeDeal.rounds[ 0 ] as StartedRound;

		const winningCard = getBestCardPlayed( this.data.trump, activeRound );
		this.logger.info( "Winning Card: %s", winningCard );

		const winningPlayer = activeRound.playerOrder.find( p => activeRound.cards[ p ] === winningCard! );
		this.logger.info( "Player %s won the round", winningPlayer );

		activeRound.status = "COMPLETED";
		activeRound.winner = winningPlayer;
		activeDeal.wins[ winningPlayer! ] = ( activeDeal.wins[ winningPlayer! ] || 0 ) + 1;

		activeDeal.rounds[ 0 ] = activeRound;
		this.data.deals[ 0 ] = activeDeal;
		this.data.status = "ROUND_COMPLETED";

		this.logger.debug( "<< completeRound()" );
	}

	/**
	 * Finalize the active deal, compute scores for each player based on declared vs actual wins,
	 * and update the game status.
	 *
	 * Scoring:
	 * - Declared > won: score = -10 * declared
	 * - Declared <= won: score = (10 * declared) + (2 * (won - declared))
	 *
	 * Side effects:
	 * - Mutates this.data.scores and sets deal/status flags.
	 *
	 * @private
	 */
	private completeDeal() {
		this.logger.debug( ">> completeDeal()" );

		const activeDeal = this.data.deals[ 0 ];
		Object.keys( this.data.players ).forEach( playerId => {
			const declared = activeDeal.declarations[ playerId ];
			const won = activeDeal.wins[ playerId ];
			const score = declared > won ? ( -10 * declared ) : ( 10 * declared ) + ( 2 * ( won - declared ) );
			this.data.scores[ playerId ].push( score );
		} );

		activeDeal.status = "COMPLETED";
		this.data.deals[ 0 ] = activeDeal;
		this.data.status = "DEAL_COMPLETED";

		this.logger.debug( "<< completeDeal()" );
	}

	/**
	 * Mark the game as completed and perform any game-level cleanup.
	 * Side effects:
	 * - Mutates this.data.status to GAME_COMPLETED.
	 *
	 * @private
	 */
	private async completeGame() {
		this.logger.debug( ">> completeGame()" );
		this.data.status = "GAME_COMPLETED";
		this.logger.debug( "<< completeGame()" );
	}

	/**
	 * Validate whether a new player can join.
	 * Does not mutate state.
	 *
	 * @returns Error message if the game is full, otherwise empty object.
	 * @private
	 */
	private validateJoinGame() {
		this.logger.debug( ">> validateJoinGame()" );

		if ( Object.keys( this.data.players ).length >= 4 ) {
			this.logger.error( "Game Full: %s", this.data.id );
			return { error: "Game full!" };
		}

		this.logger.debug( "<< validateJoinGame()" );
		return {};
	}

	/**
	 * Validate whether bots can be added by the requesting player.
	 * Does not mutate state.
	 *
	 * Checks:
	 * - Requesting player is the game creator.
	 * - Game is not already full.
	 *
	 * @param authInfo Player authentication metadata.
	 * @returns Error message on validation failure or empty object on success.
	 * @private
	 */
	private validateAddBots( authInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validateAddBots()" );

		if ( this.data.createdBy !== authInfo.id ) {
			this.logger.error( "Only Creator Can Add Bots: %s", authInfo.id );
			return { error: "Only the game creator can add bots!" };
		}

		if ( Object.keys( this.data.players ).length >= 4 ) {
			this.logger.error( "Game Full: %s", this.data.id );
			return { error: "Game already has 4 players!" };
		}

		this.logger.debug( "<< validateAddBots()" );
		return {};
	}

	/**
	 * Validate a declare-deal-wins request.
	 * Does not mutate state.
	 *
	 * Checks:
	 * - Player is in game.
	 * - It is the player's turn.
	 * - Active deal exists and matches input.dealId.
	 *
	 * @param input The DeclareDealWinsInput containing dealId and wins.
	 * @param authInfo Player authentication metadata.
	 * @returns Error message on validation failure or empty object on success.
	 * @private
	 */
	private validateDealWinDeclaration( input: DeclareDealWinsInput, authInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validateDealWinDeclaration()" );

		if ( !this.data.players[ authInfo.id ] ) {
			this.logger.error( "Player Not in Game: %s", authInfo.id );
			return { error: "Player not in game!" };
		}

		if ( this.data.currentTurn !== authInfo.id ) {
			this.logger.error( "Not Your Turn: %s", authInfo.id );
			return { error: "Not your turn!" };
		}

		const currentDeal = this.data.deals[ 0 ];
		if ( !currentDeal || currentDeal.id !== input.dealId ) {
			this.logger.error( "Active Deal Not Found: %s", this.data.id );
			return { error: "Active deal not found!" };
		}

		this.logger.debug( "<< validateDealWinDeclaration()" );
		return {};
	}

	/**
	 * Validate a play-card request.
	 * Does not mutate state.
	 *
	 * Checks:
	 * - Player is part of the game and it is their turn.
	 * - Deal and round exist and match IDs in the input.
	 * - The card played is in the player's hand and is playable given current suit/trump/cards played.
	 *
	 * @param input The PlayCardInput containing gameId, dealId, roundId and cardId.
	 * @param authInfo Player authentication metadata.
	 * @returns Error message on validation failure or empty object on success.
	 * @private
	 */
	private validatePlayCard( input: PlayCardInput, authInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validatePlayCard()" );

		if ( !this.data.players[ authInfo.id ] ) {
			this.logger.error( "Player Not in Game: %s", authInfo.id );
			return { error: "Player not in game!" };
		}

		if ( this.data.currentTurn !== authInfo.id ) {
			this.logger.error( "Not Your Turn: %s", authInfo.id );
			return { error: "Not your turn!" };
		}

		const currentDeal = this.data.deals[ 0 ];
		if ( !currentDeal || currentDeal.id !== input.dealId ) {
			this.logger.error( "Deal Not Found: %s", input.dealId );
			return { error: "Deal not found!" };
		}

		const currentRound = currentDeal.rounds[ 0 ];
		if ( !currentRound || currentRound.id !== input.roundId ) {
			this.logger.error( "Round Not Found: %s", input.roundId );
			return { error: "Round not found!" };
		}

		const hand = currentDeal.hands[ authInfo.id ];
		if ( !hand.includes( input.cardId ) ) {
			this.logger.error( "Card Not Yours: %s", input.cardId );
			return { error: "Card not in hand!" };
		}

		const playableCards = getPlayableCards( hand, this.data.trump, currentRound );
		if ( !playableCards.includes( input.cardId ) ) {
			this.logger.error( "Invalid Card: %s", input.cardId );
			return { error: "Card cannot be played!" };
		}

		this.logger.debug( "<< validatePlayCard()" );
		return {};
	}

	/**
	 * Broadcast player-facing game snapshots over the WSS Durable Object.
	 * Side effects:
	 * - Reads this.data and calls the WSS object's broadcast method.
	 *
	 * @private
	 */
	private async broadcastGameData() {
		this.logger.debug( ">> broadcast()" );

		const durableObjectId = this.env.WSS.idFromName( `callbreak:${ this.data.id }` );
		const wss = this.env.WSS.get( durableObjectId );
		await wss.broadcast( this.getPlayerDataMap() );

		this.logger.debug( "<< broadcast()" );
	}

	/**
	 * Helper to set a storage alarm after deleting any existing alarm.
	 * Side effects:
	 * - Calls ctx.storage.deleteAlarm() and ctx.storage.setAlarm().
	 *
	 * @param ms Milliseconds in the future to fire the alarm.
	 * @private
	 */
	private async setAlarm( ms: number ) {
		this.logger.info( "Setting alarm for gameId:", this.data.id, "in", ms, "ms" );
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.setAlarm( Date.now() + ms );
	}

	/**
	 * Load persisted GameData from CALLBREAK_KV.
	 *
	 * @returns Parsed GameData or undefined if not present.
	 * @private
	 */
	private async loadGameData() {
		return this.env.CALLBREAK_KV.get<GameData>( this.key, "json" );
	}

	/**
	 * Persist the current in-memory GameData to CALLBREAK_KV.
	 * Side effects:
	 * - Serializes and writes this.data to the CALLBREAK_KV namespace.
	 *
	 * @private
	 */
	private async saveGameData() {
		await this.env.CALLBREAK_KV.put( this.key, JSON.stringify( this.data ) );
	}

	/**
	 * Persist durable object mappings (code -> DO id, gameId -> DO id) into KV.
	 * Side effects:
	 * - Writes keys to CALLBREAK_KV.
	 *
	 * @private
	 */
	private async saveDurableObjectId() {
		await this.env.CALLBREAK_KV.put( `code:${ this.data.code }`, this.key );
		await this.env.CALLBREAK_KV.put( `gameId:${ this.data.id }`, this.key );
	}
}

