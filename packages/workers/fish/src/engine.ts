import { CARD_RANKS, SORTED_DECK } from "@s2h/cards/constants";
import type { CardId } from "@s2h/cards/types";
import {
	generateDeck,
	generateHands,
	getCardDisplayString,
	getCardFromId,
	getCardId,
	isCardInHand
} from "@s2h/cards/utils";
import { chunk, remove } from "@s2h/utils/array";
import { generateAvatar, generateGameCode, generateId, generateName, generateTeamName } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import { DurableObject } from "cloudflare:workers";
import { format } from "node:util";
import type {
	AskEventInput,
	BasePlayerInfo,
	BookType,
	CanadianBook,
	ClaimEventInput,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	NormalBook,
	PlayerGameInfo,
	PlayerId,
	StartGameInput,
	TeamCount,
	TransferEventInput,
	WeightedAsk,
	WeightedBook,
	WeightedClaim,
	WeightedTransfer
} from "./types.ts";
import {
	CANADIAN_BOOKS,
	GAME_STATUS,
	getBookForCard,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	NORMAL_BOOKS
} from "./utils.ts";

const MAX_WEIGHT = 720;

type CloudflareEnv = {
	FISH_KV: KVNamespace;
	WSS: DurableObjectNamespace<import("../../../api/src/wss.ts").WebsocketServer>;
}

/**
 * @class FishEngine
 * @description Core engine for managing the state and logic of a Fish card game.
 * Handles player actions, game state transitions, and provides game data to players.
 * It manages the game lifecycle from creation to completion, including player turns,
 * team management, and card handling.
 */
export class FishEngine extends DurableObject<CloudflareEnv> {

	private readonly logger = createLogger( "Fish:Engine" );
	private readonly key: string;
	private data: GameData;

	constructor( ctx: DurableObjectState, env: CloudflareEnv ) {
		super( ctx, env );
		this.key = ctx.id.toString();
		this.data = FishEngine.initialGameData( { playerCount: 6 } );

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
	 * Creates a new game instance with the provided configuration
	 * and initializes the game state.
	 * @param {CreateGameInput} input - Configuration input for creating the game
	 * @returns {GameData} - Default Game Data for the game
	 */
	public static initialGameData( input: CreateGameInput ): GameData {
		return {
			id: generateId(),
			code: generateGameCode(),
			status: GAME_STATUS.CREATED,
			currentTurn: "",
			config: {
				type: "NORMAL",
				playerCount: input.playerCount ?? 6,
				teamCount: 2,
				books: [],
				deckType: 48
			},

			playerIds: [],
			players: {},

			teamIds: [],
			teams: {},

			hands: {},
			cardCounts: {},
			cardMappings: this.getDefaultCardMappings(),
			bookStates: this.getDefaultBookStates( "NORMAL" ),

			askHistory: [],
			claimHistory: [],
			transferHistory: [],
			metrics: {}
		};
	}

	/**
	 * Generates default card mappings for the game.
	 * Each card is mapped to an empty string, indicating no known owner.
	 * @returns {Record<CardId, PlayerId>} - The default card mappings object.
	 * @private
	 */
	private static getDefaultCardMappings(): Record<CardId, PlayerId> {
		return SORTED_DECK.reduce(
			( acc, card ) => {
				const cardId = getCardId( card );
				acc[ cardId ] = "";
				return acc;
			},
			{} as Record<CardId, PlayerId>
		);
	}

	/**
	 * Generates default book state data for the game.
	 * Each book contains its cards, known owners, possible owners, inferred owners, and known counts.
	 * @param {BookType} bookType - The type of core book (NORMAL or CANADIAN).
	 * @param {PlayerId[]} playerIds - Optional array of player IDs to initialize possible owners.
	 * @returns {GameData["bookStates"]} - The default book state data.
	 * @private
	 */
	private static getDefaultBookStates( bookType: BookType, playerIds: PlayerId[] = [] ): GameData["bookStates"] {
		if ( bookType === "NORMAL" ) {
			return Object.keys( NORMAL_BOOKS ).map( k => k as NormalBook ).reduce(
				( acc, book ) => {
					const ownerState = this.getDefaultBookCardsState( NORMAL_BOOKS[ book ], playerIds );
					acc[ book ] = {
						cards: NORMAL_BOOKS[ book ],
						knownOwners: ownerState.knownOwners,
						possibleOwners: ownerState.possibleOwners,
						inferredOwners: ownerState.inferredOwners,
						knownCounts: {}
					};
					return acc;
				},
				{} as GameData["bookStates"]
			);
		} else {
			return Object.keys( CANADIAN_BOOKS ).map( k => k as CanadianBook ).reduce(
				( acc, book ) => {
					const ownerState = this.getDefaultBookCardsState( CANADIAN_BOOKS[ book ], playerIds );
					acc[ book ] = {
						cards: CANADIAN_BOOKS[ book ],
						knownOwners: ownerState.knownOwners,
						possibleOwners: ownerState.possibleOwners,
						inferredOwners: ownerState.inferredOwners,
						knownCounts: {}
					};
					return acc;
				},
				{} as GameData["bookStates"]
			);
		}
	}

	private static getDefaultBookCardsState( cardIds: CardId[], playerIds: PlayerId[] = [] ) {
		return cardIds.reduce(
			( acc, cardId ) => {
				acc.knownOwners[ cardId ] = "";
				acc.possibleOwners[ cardId ] = playerIds;
				acc.inferredOwners[ cardId ] = "";
				return acc;
			},
			{
				knownOwners: {} as Record<CardId, PlayerId>,
				possibleOwners: {} as Record<CardId, PlayerId[]>,
				inferredOwners: {} as Record<CardId, PlayerId>
			}
		);
	}

	/**
	 * Generates default team data by dividing players into teams with generated names.
	 * @param teamCount - The number of teams to create.
	 * @param players - The list of player IDs to be divided into teams.
	 * @private
	 */
	private static getDefaultTeamData( teamCount: TeamCount, players: PlayerId[] ) {
		const names = Array( teamCount ).fill( 0 ).map( () => generateTeamName() );
		const groups = chunk( players, players.length / teamCount );
		return names.reduce(
			( acc, name, idx ) => {
				acc[ name ] = groups[ idx ];
				return acc;
			},
			{} as Record<string, PlayerId[]>
		);
	}

	public async updateConfig( input: Partial<CreateGameInput>, playerId: string ) {
		this.logger.debug( ">> updateConfig()" );

		this.data.config.playerCount = input.playerCount ?? this.data.config.playerCount;
		this.data.currentTurn = playerId;

		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 60000 );

		this.logger.debug( "<< updateConfig()" );
		return { code: this.data.code, gameId: this.data.id };
	}

	/**
	 * Adds a player to the game if there is space and the player is not already part of the game.
	 * This method updates the game state to include the new player and checks if the game is ready to start.
	 * @param playerInfo - The authentication information of the player to be added.s
	 */
	public async addPlayer( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> addPlayer()" );

		this.data.playerIds.push( playerInfo.id );
		this.data.players[ playerInfo.id ] = {
			...playerInfo,
			teamId: "",
			teamMates: [],
			opponents: [],
			isBot: false
		};

		this.data.metrics[ playerInfo.id ] = {
			totalAsks: 0,
			cardsTaken: 0,
			cardsGiven: 0,
			totalClaims: 0,
			successfulClaims: 0
		};

		if ( this.data.playerIds.length === this.data.config.playerCount ) {
			this.data.status = GAME_STATUS.PLAYERS_READY;
		}

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< addPlayer()" );
	}

	/**
	 * Automatically fills the game with bot players until the required player count is reached.
	 * This method is typically called when the game is ready to start but lacks enough human players.
	 * It generates bot players with random names and avatars.
	 */
	public async addBots() {
		this.logger.debug( ">> addBots()" );

		const botsToAdd = this.data.config.playerCount - this.data.playerIds.length;
		for ( let i = 0; i < botsToAdd; i++ ) {
			const botId = generateId();
			this.data.playerIds.push( botId );
			this.data.players[ botId ] = {
				id: botId,
				name: generateName(),
				username: generateName(),
				avatar: generateAvatar(),
				teamId: "",
				teamMates: [],
				opponents: [],
				isBot: true
			};

			this.data.metrics[ botId ] = {
				totalAsks: 0,
				cardsTaken: 0,
				cardsGiven: 0,
				totalClaims: 0,
				successfulClaims: 0
			};
		}

		this.data.status = GAME_STATUS.PLAYERS_READY;

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< addBots()" );
	}

	/**
	 * Creates teams based on the provided input, assigning players to teams and
	 * updating their team-related information. This method also transitions
	 * the game state to TEAMS_CREATED.
	 * @param input - The input containing team names and their respective player IDs.
	 */
	public async createTeams( input: CreateTeamsInput ) {
		this.logger.debug( ">> createTeams()" );

		this.data.config.teamCount = Object.keys( input.data ).length as TeamCount;
		Object.entries( input.data ).forEach( ( [ name, players ] ) => {
			const id = generateId();
			this.data.teamIds.push( id );
			this.data.teams[ id ] = { id, name, players, score: 0, booksWon: [] };
			players.forEach( playerId => {
				const teamMates = remove( p => p === playerId, players );
				const opponents = remove( p => p === playerId || teamMates.includes( p ), this.data.playerIds );
				this.data.players[ playerId ].teamId = id;
				this.data.players[ playerId ].teamMates = teamMates;
				this.data.players[ playerId ].opponents = opponents;
			} );
		} );

		this.data.status = GAME_STATUS.TEAMS_CREATED;

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< createTeams()" );
	}

	/**
	 * Starts the game by initializing the deck, dealing hands to players,
	 * and setting the game status to IN_PROGRESS. This method also validates
	 * the game state before starting.
	 * @param deckType - The type of deck to be used (e.g., 52 or 48 cards).
	 * @param type - The type of game (e.g., NORMAL or CANADIAN).
	 * @param authInfo - The authentication information of the player starting the game.
	 */
	public async startGame( { deckType, type }: StartGameInput ) {
		this.logger.debug( ">> startGame()" );

		this.data.config.deckType = deckType;
		this.data.config.type = type;
		this.data.config.books = this.data.config.type === "NORMAL"
			? Object.keys( NORMAL_BOOKS ).map( k => k as NormalBook )
			: Object.keys( CANADIAN_BOOKS ).map( k => k as CanadianBook );

		let deck = generateDeck();
		if ( this.data.config.deckType === 48 ) {
			deck = remove( ( { rank } ) => rank === CARD_RANKS.SEVEN, deck );
		}

		const hands = generateHands( deck, this.data.config.playerCount );
		this.data.playerIds.forEach( ( playerId, idx ) => {
			this.data.hands[ playerId ] = hands[ idx ].map( getCardId );
			this.data.cardCounts[ playerId ] = hands[ idx ].length;
			hands[ idx ].forEach( card => {
				const cardId = getCardId( card );
				this.data.cardMappings[ cardId ] = playerId;
			} );
		} );

		this.data.bookStates = FishEngine.getDefaultBookStates( this.data.config.type, this.data.playerIds );
		this.data.status = GAME_STATUS.IN_PROGRESS;

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< startGame()" );
	}

	/**
	 * Handles an ask event where a player requests a card from another player.
	 * This method updates the game state based on the outcome of the ask,
	 * including card ownership and turn management.
	 * @param event - The ask event input containing details of the ask action.
	 */
	public async handleAskEvent( event: AskEventInput ) {
		this.logger.debug( ">> handleAskEvent()" );

		const playerId = this.data.currentTurn;
		const askedBook = getBookForCard( event.cardId, this.data.config.type );
		const success = event.from === this.data.cardMappings[ event.cardId ];
		const receivedString = success ? "got the card!" : "was declined!";
		const cardDisplayString = getCardDisplayString( event.cardId );
		const description = format(
			"%s asked %s for %s and %s",
			this.data.players[ playerId ].name,
			this.data.players[ event.from ].name,
			cardDisplayString,
			receivedString
		);

		if ( !this.data.bookStates[ askedBook ] ) {
			this.data.bookStates[ askedBook ] = {
				cards: getCardsOfBook( askedBook, this.data.config.type ).map( getCardId ),
				knownOwners: {},
				possibleOwners: {},
				inferredOwners: {},
				knownCounts: {}
			};
		}

		const ask = { id: generateId(), success, description, ...event, timestamp: Date.now(), playerId };
		this.data.askHistory.unshift( ask );
		this.data.lastMoveType = "ask";

		const nextTurn = !ask.success ? ask.from : ask.playerId;
		if ( nextTurn !== this.data.currentTurn ) {
			this.data.currentTurn = nextTurn;
		}

		if ( success ) {
			this.data.cardMappings[ ask.cardId ] = ask.playerId;
			this.data.hands[ ask.playerId ].push( event.cardId );
			this.data.hands[ ask.from ] = remove( card => card === ask.cardId, this.data.hands[ ask.from ] );
			this.data.cardCounts[ ask.playerId ]++;
			this.data.cardCounts[ ask.from ]--;

			this.data.bookStates[ askedBook ].knownOwners[ ask.cardId ] = ask.playerId;
			this.data.bookStates[ askedBook ].possibleOwners[ ask.cardId ] = [];
		} else {
			this.data.bookStates[ askedBook ].possibleOwners[ ask.cardId ] = remove(
				( playerId ) => playerId === ask.from || playerId === ask.playerId,
				this.data.bookStates[ askedBook ].possibleOwners[ ask.cardId ] ?? []
			);

			const possibleOwners = this.data.bookStates[ askedBook ].possibleOwners[ ask.cardId ] ?? [];
			if ( possibleOwners.length === 1 ) {
				this.data.bookStates[ askedBook ].knownOwners[ ask.cardId ] = possibleOwners[ 0 ];
				this.data.bookStates[ askedBook ].possibleOwners[ ask.cardId ] = [];
			}
		}

		this.data.metrics[ ask.playerId ].totalAsks++;
		this.data.metrics[ ask.playerId ].cardsTaken += success ? 1 : 0;
		this.data.metrics[ ask.from ].cardsGiven += success ? 0 : 1;

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< handleAskEvent()" );
	}

	/**
	 * Handles a claim event where a player declares they have all cards of a specific book.
	 * This method updates the game state based on the validity of the claim,
	 * including score updates and turn management.
	 * @param event - The claim event input containing details of the claim action.
	 */
	public async handleClaimEvent( event: ClaimEventInput ) {
		this.logger.debug( ">> handleClaimEvent()" );

		const playerId = this.data.currentTurn;
		const calledCards = Object.keys( event.claim ).map( cardId => cardId as CardId );
		const [ calledBook ] = calledCards.map( cardId => getBookForCard( cardId, this.data.config.type ) );
		const correctClaim = calledCards.reduce(
			( acc, cardId ) => {
				acc[ cardId ] = this.data.cardMappings[ cardId ];
				return acc;
			},
			{} as Partial<Record<CardId, string>>
		);

		let success = true;
		let successString = "correctly!";

		for ( const cardId of calledCards ) {
			if ( correctClaim[ cardId ] !== event.claim[ cardId ] ) {
				success = false;
				successString = "incorrectly!";
				break;
			}
		}

		const description = format(
			"%s declared %s %s",
			this.data.players[ playerId ].name,
			calledBook,
			successString
		);

		const claim = {
			id: generateId(),
			success,
			description,
			playerId,
			book: calledBook,
			correctClaim,
			actualClaim: event.claim,
			timestamp: Date.now()
		};

		this.data.claimHistory.unshift( claim );

		calledCards.map( cardId => {
			delete this.data.cardMappings[ cardId ];
			delete this.data.bookStates[ calledBook ];

			const hand = this.data.hands[ correctClaim[ cardId ]! ];
			this.data.hands[ correctClaim[ cardId ]! ] = remove( card => card === cardId, hand );
			this.data.cardCounts[ correctClaim[ cardId ]! ]--;
		} );

		let winningTeamId = this.data.players[ playerId ].teamId;

		if ( !success ) {
			[ winningTeamId ] = this.data.teamIds.filter( teamId => teamId !== winningTeamId );
		}

		this.data.teams[ winningTeamId ].score++;
		this.data.teams[ winningTeamId ].booksWon.push( calledBook );

		const booksCompleted = [ calledBook ];
		Object.values( this.data.teams ).forEach( team => {
			booksCompleted.push( ...team.booksWon );
		} );

		this.logger.debug( "BooksCompleted: %o", booksCompleted );
		if ( booksCompleted.length === 8 ) {
			this.data.status = GAME_STATUS.COMPLETED;
			return;
		}

		const opponentsWithCards = this.data.players[ playerId ].opponents
			.filter( opponentId => !!this.data.cardCounts[ opponentId ] );

		this.data.currentTurn = !success ? opponentsWithCards[ 0 ] : playerId;
		this.data.lastMoveType = "claim";

		this.data.metrics[ playerId ].totalClaims++;
		this.data.metrics[ playerId ].successfulClaims += success ? 1 : 0;

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< handleClaimEvent()" );
	}

	/**
	 * Handles a transfer event where a player transfers their turn to a teammate.
	 * This method updates the game state to reflect the transfer of turn.
	 * @param event - The transfer event input containing details of the transfer action.
	 */
	public async handleTransferEvent( event: TransferEventInput ) {
		this.logger.debug( ">> handleTransferEvent()" );

		const transferringPlayer = this.data.players[ this.data.currentTurn ];
		const receivingPlayer = this.data.players[ event.transferTo ];

		const transfer = {
			id: generateId(),
			playerId: transferringPlayer.id,
			description: `${ transferringPlayer.name } transferred the turn to ${ receivingPlayer.name }`,
			transferTo: event.transferTo,
			timestamp: Date.now()
		};

		this.data.currentTurn = event.transferTo;
		this.data.lastMoveType = "transfer";
		this.data.transferHistory.unshift( transfer );

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< handleTransferEvent()" );
	}

	/**
	 * Retrieves game information specific to a player, including their hand of cards.
	 * @param {PlayerId} playerId - The ID of the player for whom to retrieve game information.
	 * @returns {PlayerGameInfo} - The game information for the specified player, including their hand.
	 */
	public getPlayerGameInfo( playerId: PlayerId ): PlayerGameInfo {
		const { hands, cardMappings, ...rest } = this.data;
		return { ...rest, playerId, hand: hands[ playerId ]?.map( getCardFromId ) || [] };
	}

	/**
	 * Automates game actions for bot players based on the current game state.
	 * This method checks the game status and performs appropriate actions for bot players,
	 * such as joining the game, creating teams, starting the game, and making moves during their turn.
	 */
	override async alarm() {
		this.logger.debug( ">> alarm()" );

		let setNextAlarm = false;
		const currentPlayer = this.data.players[ this.data.currentTurn ];
		switch ( this.data.status ) {
			case "CREATED": {
				await this.addBots();
				setNextAlarm = true;
				break;
			}
			case "PLAYERS_READY": {
				const teamData = FishEngine.getDefaultTeamData( this.data.config.teamCount, this.data.playerIds );
				await this.createTeams( { gameId: this.data.id, data: teamData } );
				setNextAlarm = true;
				break;
			}
			case "TEAMS_CREATED": {
				const input: StartGameInput = { type: "NORMAL", deckType: 48, gameId: this.data.id };
				await this.startGame( input );
				setNextAlarm = true;
				break;
			}
			case "IN_PROGRESS": {
				if ( currentPlayer.isBot ) {
					setNextAlarm = true;
					this.logger.debug( "Player Hand: %o", this.data.hands[ currentPlayer.id ] );

					const weightedBooks = this.suggestBooks();
					this.logger.debug( "Books Suggested: %o", weightedBooks.map( book => book.book ) );

					const isLastMoveSuccessfulClaim = this.data.lastMoveType === "claim"
						&& this.data.claimHistory[ 0 ]?.success
						&& this.data.claimHistory[ 0 ]?.playerId === this.data.currentTurn;

					if ( isLastMoveSuccessfulClaim ) {
						const weightedTransfers = this.suggestTransfers( weightedBooks );
						this.logger.debug(
							"Transfers Suggested: %o",
							weightedTransfers.map( transfer => transfer.transferTo )
						);

						if ( weightedTransfers.length > 0 ) {
							const transferTo = weightedTransfers[ 0 ].transferTo;
							this.logger.info( "Bot %s transferring turn to %s", currentPlayer.id, transferTo );
							const input: TransferEventInput = { gameId: this.data.id, transferTo };
							await this.handleTransferEvent( input );
							break;
						}
					}

					this.logger.info( "Bot %s skipping transfer!", currentPlayer.id );

					const weightedClaims = this.suggestClaims( weightedBooks );
					this.logger.debug( "Claims Suggested: %o", weightedClaims.map( claim => claim.book ) );

					if ( weightedClaims.length > 0 ) {
						const claim = weightedClaims[ 0 ].claim;
						this.logger.info( "Bot %s claiming book with cards: %o", currentPlayer.id, claim );
						const input: ClaimEventInput = { gameId: this.data.id, claim };
						await this.handleClaimEvent( input );
						break;
					}

					this.logger.info( "Bot %s skipping claim!", currentPlayer.id );

					const weightedAsks = this.suggestAsks( weightedBooks );
					this.logger.debug( "Asks Suggested: %o", new Set( weightedAsks.map( ask => ask.cardId ) ) );
					if ( weightedAsks.length > 0 ) {
						const { playerId, cardId } = weightedAsks[ 0 ];
						this.logger.info( "Bot %s asking %s for card %s", currentPlayer.id, playerId, cardId );
						const event: AskEventInput = { gameId: this.data.id, from: playerId, cardId };
						await this.handleAskEvent( event );
						break;
					}

					this.logger.info( "No Valid move found for bot %s!", currentPlayer.id );
				}
				break;
			}
			case "COMPLETED": {
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

	public async setAlarm( ms: number ) {
		this.logger.info( "Setting alarm for gameId:", this.data.id, "in", ms, "ms" );
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.setAlarm( Date.now() + ms );
	}

	private getPlayerDataMap(): Record<PlayerId, PlayerGameInfo> {
		return Object.keys( this.data.players ).reduce(
			( acc, playerId ) => {
				const { hands, cardMappings, ...rest } = this.data;
				acc[ playerId ] = { ...rest, playerId, hand: hands[ playerId ]?.map( getCardFromId ) || [] };
				return acc;
			},
			{} as Record<string, PlayerGameInfo>
		);
	}

	/**
	 * Suggests books that the player can ask from or claim based on their hand and the current game state.
	 * The books are weighted based on how likely they are to be completed.
	 * The weight is calculated for each card and averaged for a book. It is calculated as follows:
	 * - If the player has the card in hand, the weight is MAX_WEIGHT.
	 * - If the card's owner is known, the weight is MAX_WEIGHT.
	 * - If the card's owner is inferred, the weight is MAX_WEIGHT / 2.
	 * - If the card's owner is neither known nor inferred, the weight is MAX_WEIGHT / number of possible owners.
	 * @returns {WeightedBook[]} - An array of weighted books that the player can ask from or claim.
	 * @private
	 */
	private suggestBooks(): WeightedBook[] {
		this.logger.debug( ">> suggestBooks()" );

		const { playerId, hand, players, bookStates, config } = this.getPlayerGameInfo( this.data.currentTurn );
		const booksInHand = getBooksInHand( hand, config.type );
		const validBooks = config.books.filter( book => !!bookStates[ book ] && booksInHand.includes( book ) );
		const currentPlayer = players[ playerId ];
		const weightedBooks: WeightedBook[] = [];

		for ( const book of validBooks ) {

			const weightedBook = { book, weight: 0, isBookWithTeam: true, isClaimable: true, isKnown: true };
			const state = bookStates[ book ];
			if ( !state ) {
				continue;
			}

			for ( const cardId of state.cards ) {

				if ( isCardInHand( hand, cardId ) ) {
					weightedBook.weight += MAX_WEIGHT;
					continue;
				}

				if ( state.knownOwners[ cardId ] ) {
					weightedBook.weight += MAX_WEIGHT;
					if ( !currentPlayer.teamMates.includes( state.knownOwners[ cardId ] ) ) {
						weightedBook.isBookWithTeam = false;
						weightedBook.isClaimable = false;
					}
					continue;
				}

				if ( state.inferredOwners[ cardId ] ) {
					weightedBook.weight += MAX_WEIGHT / 2;
					if ( !currentPlayer.teamMates.includes( state.inferredOwners[ cardId ] ) ) {
						weightedBook.isBookWithTeam = false;
						weightedBook.isClaimable = false;
					}
					continue;
				}

				if ( state.possibleOwners[ cardId ] && state.possibleOwners[ cardId ].length > 0 ) {
					weightedBook.isKnown = false;
					weightedBook.isClaimable = false;
					weightedBook.weight += MAX_WEIGHT / state.possibleOwners[ cardId ].length;

					if ( !state.possibleOwners[ cardId ].every( pid => currentPlayer.teamMates.includes( pid ) ) ) {
						weightedBook.isBookWithTeam = false;
					}
				}

				if ( !getBooksInHand( hand, config.type ).includes( book ) ) {
					weightedBook.isClaimable = false;
				}
			}

			weightedBooks.push( { ...weightedBook, weight: weightedBook.weight / state.cards.length } );
		}

		this.logger.debug( "<< suggestBooks()" );
		return weightedBooks.toSorted( ( a, b ) => b.weight - a.weight );
	}

	/**
	 * Suggests asks for cards based on the player's hand and the current game state.
	 * The asks are weighted based on the likelihood of getting the card from the specified player.
	 * The weight is calculated as follows:
	 * - If the card's owner is known, the weight is MAX_WEIGHT.
	 * - If the card's owner is inferred, the weight is MAX_WEIGHT / 2.
	 * - If the card's owner is neither known nor inferred, the weight is MAX_WEIGHT / number of possible owners.
	 * @param {WeightedBook[]} books - The list of books in the game.
	 * @returns {WeightedAsk[]} - An array of weighted asks that the player can make.
	 */
	private suggestAsks( books: WeightedBook[] ): WeightedAsk[] {
		this.logger.debug( ">> suggestAsks()" );

		const data = this.getPlayerGameInfo( this.data.currentTurn );
		const { playerId, hand, players, bookStates, config } = data;
		const currentPlayer = players[ playerId ];
		const weightedAsks: WeightedAsk[] = [];

		for ( const { book } of books ) {
			const missingCards = getMissingCards( hand, book, config.type );
			const asksForBook: WeightedAsk[] = [];
			const state = bookStates[ book ];
			if ( !state ) {
				continue;
			}

			for ( const cardId of missingCards ) {
				const knownOwner = state.knownOwners[ cardId ];
				const possibleOwners = state.possibleOwners[ cardId ] ?? [];

				if ( knownOwner && knownOwner !== playerId && !currentPlayer.teamMates.includes( knownOwner ) ) {
					asksForBook.push( { playerId: knownOwner, cardId, weight: MAX_WEIGHT } );
				} else {
					for ( const pid of possibleOwners ) {
						if ( pid !== playerId && !currentPlayer.teamMates.includes( pid ) ) {
							asksForBook.push( { playerId: pid, cardId, weight: MAX_WEIGHT / possibleOwners.length } );
						}
					}
				}
			}

			weightedAsks.push( ...asksForBook.toSorted( ( a, b ) => b.weight - a.weight ) );
		}

		this.logger.debug( "<< suggestAsks()" );
		return weightedAsks;
	}

	/**
	 * Suggests claims for books based on the current game state.
	 * The claims are weighted based on the completeness of the book and the known/inferred owners of the cards.
	 * The weight of a claim is summed up from the weights of the cards in the book:
	 * - If the card's owner is known, the weight is MAX_WEIGHT.
	 * - If the card's owner is inferred, the weight is MAX_WEIGHT / 2.
	 * - If the card's owner is neither known nor inferred, the book is not claimable.
	 * @param {WeightedBook[]} books - The list of weighted books in the game.
	 * @return {WeightedClaim[]} - An array of weighted claims that the player can make.
	 * @private
	 */
	private suggestClaims( books: WeightedBook[] ): WeightedClaim[] {
		this.logger.debug( ">> suggestClaims()" );

		const { bookStates } = this.getPlayerGameInfo( this.data.currentTurn );
		const validBooks = books.filter( book => book.isClaimable && book.isBookWithTeam );
		const claims: WeightedClaim[] = [];

		for ( const { book } of validBooks ) {
			const state = bookStates[ book ];
			let weight = 0;
			const claim = {} as Record<CardId, PlayerId>;
			if ( !state ) {
				continue;
			}

			for ( const cardId of state.cards ) {
				if ( state.knownOwners[ cardId ] ) {
					weight += MAX_WEIGHT;
					claim[ cardId ] = state.knownOwners[ cardId ];
				} else if ( state.inferredOwners[ cardId ] ) {
					weight += MAX_WEIGHT / 2;
					claim[ cardId ] = state.inferredOwners[ cardId ];
				}
			}

			if ( Object.keys( claim ).length === state.cards.length ) {
				claims.push( { book, claim, weight } );
			}
		}

		this.logger.debug( "<< suggestClaims()" );
		return claims.sort( ( a, b ) => b.weight - a.weight );
	}

	/**
	 * Suggests transfers of cards to team members based on the current game state.
	 * The transfers are weighted based on the number of cards that can be transferred to teammates.
	 * Preference is given to books that are not completely with the team and have maximum
	 * information about card ownership. If there are no books which can be snatched,
	 * there's no need to transfer turn
	 * @param {WeightedBook[]} books - The list of weighted books in the game.
	 * @returns {WeightedTransfer[]} - An array of suggested transfers with weights.
	 * @private
	 */
	private suggestTransfers( books: WeightedBook[] ): WeightedTransfer[] {
		this.logger.debug( ">> suggestTransfers()" );

		const data = this.getPlayerGameInfo( this.data.currentTurn );
		const { playerId, players, bookStates } = data;
		const currentPlayer = players[ playerId ];
		const validBooks = books.filter( book => !book.isBookWithTeam && book.isKnown );
		const weightedTransfers = {} as Record<PlayerId, number>;

		for ( const { book } of validBooks ) {
			const state = bookStates[ book ];
			if ( !state ) {
				continue;
			}

			for ( const cardId of state.cards ) {
				const owner = state.knownOwners[ cardId ] || state.inferredOwners[ cardId ];
				if ( owner && currentPlayer.teamMates.includes( owner ) ) {
					weightedTransfers[ owner ] = ( weightedTransfers[ owner ] ?? 0 ) + MAX_WEIGHT;
				}
			}
		}

		this.logger.debug( "<< suggestTransfers()" );
		return Object.entries( weightedTransfers )
			.map( ( [ transferTo, weight ] ) => ( { transferTo, weight } ) )
			.toSorted( ( a, b ) => b.weight - a.weight );
	}

	private async broadcastGameData() {
		this.logger.debug( ">> broadcast()" );

		const durableObjectId = this.env.WSS.idFromName( `fish:${ this.data.id }` );
		const wss = this.env.WSS.get( durableObjectId );
		await wss.broadcast( this.getPlayerDataMap() );

		this.logger.debug( "<< broadcast()" );
	}

	private async loadGameData() {
		return this.env.FISH_KV.get<GameData>( this.key, "json" );
	}

	private async saveGameData() {
		await this.env.FISH_KV.put( this.key, JSON.stringify( this.data ) );
	}
}