import type { AuthInfo } from "@/auth/types";
import type {
	AskEventInput,
	BookType,
	CanadianBook,
	ClaimEventInput,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	NormalBook,
	PlayerGameInfo,
	PlayerId,
	SaveFn,
	StartGameInput,
	TeamCount,
	TransferEventInput,
	WeightedAsk,
	WeightedBook,
	WeightedClaim,
	WeightedTransfer
} from "@/fish/types";
import {
	CANADIAN_BOOKS,
	GAME_STATUS,
	getBookForCard,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	NORMAL_BOOKS
} from "@/fish/utils";
import { chunk, remove } from "@/shared/utils/array";
import {
	CARD_RANKS,
	type CardId,
	generateDeck,
	generateHands,
	getCardDisplayString,
	getCardFromId,
	getCardId,
	isCardInHand,
	SORTED_DECK
} from "@/shared/utils/cards";
import { generateAvatar, generateGameCode, generateId, generateName, generateTeamName } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger.ts";
import { format } from "node:util";

const MAX_WEIGHT = 720;

/**
 * @class FishEngine
 * @description Core engine for managing the state and logic of a Fish card game.
 * Handles player actions, game state transitions, and provides game data to players.
 * It manages the game lifecycle from creation to completion, including player turns,
 * team management, and card handling.
 */
export class FishEngine {

	private readonly logger = createLogger( "Fish:Engine" );
	private readonly data: GameData;
	private readonly save: SaveFn;

	/**
	 * Creates an instance of FishEngine.
	 * @param data - The initial game data.
	 * @param saveFn - A function to save the game state.
	 */
	public constructor( data: GameData, saveFn: SaveFn ) {
		this.data = data;
		this.save = saveFn;
	}

	/**
	 * Gets the unique identifier of the game.
	 * This ID is used to reference the game in various operations and is immutable once the game is created.
	 * @returns {string} The game ID.
	 */
	public get id(): string {
		return this.data.id;
	}

	/**
	 * Creates a new game instance with the provided configuration
	 * and initializes the game state.
	 * @param input - Configuration input for creating the game.
	 * @param authInfo - Authentication information of the game creator.
	 * @param saveFn - A function to save the game state.
	 */
	public static create( input: CreateGameInput, authInfo: AuthInfo, saveFn: SaveFn ) {
		const game: GameData = {
			id: generateId(),
			code: generateGameCode(),
			status: GAME_STATUS.CREATED,
			currentTurn: authInfo.id,
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

		return new FishEngine( game, saveFn );
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
		const { knownOwners, possibleOwners, inferredOwners } = SORTED_DECK.reduce(
			( acc, card ) => {
				const cardId = getCardId( card );
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

		if ( bookType === "NORMAL" ) {
			return Object.keys( NORMAL_BOOKS ).map( k => k as NormalBook ).reduce(
				( acc, book ) => {
					acc[ book ] = {
						cards: NORMAL_BOOKS[ book ],
						knownOwners,
						possibleOwners,
						inferredOwners,
						knownCounts: {}
					};
					return acc;
				},
				{} as GameData["bookStates"]
			);
		} else {
			return Object.keys( CANADIAN_BOOKS ).map( k => k as CanadianBook ).reduce(
				( acc, book ) => {
					acc[ book ] = {
						cards: CANADIAN_BOOKS[ book ],
						knownOwners,
						possibleOwners,
						inferredOwners,
						knownCounts: {}
					};
					return acc;
				},
				{} as GameData["bookStates"]
			);
		}
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

	/**
	 * Adds a player to the game if there is space and the player is not already part of the game.
	 * This method updates the game state to include the new player and checks if the game is ready to start.
	 * @param playerInfo - The authentication information of the player to be added.s
	 */
	public addPlayer( playerInfo: AuthInfo ) {
		this.logger.debug( ">> addPlayer()" );

		this.validateJoinGame( playerInfo );

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

		this.logger.debug( "<< addPlayer()" );
	}

	/**
	 * Automatically fills the game with bot players until the required player count is reached.
	 * This method is typically called when the game is ready to start but lacks enough human players.
	 * It generates bot players with random names and avatars.
	 */
	public addBots() {
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
		}

		this.data.status = GAME_STATUS.PLAYERS_READY;
		this.logger.debug( "<< addBots()" );
	}

	/**
	 * Creates teams based on the provided input, assigning players to teams and
	 * updating their team-related information. This method also transitions
	 * the game state to TEAMS_CREATED.
	 * @param input - The input containing team names and their respective player IDs.
	 * @param authInfo - The authentication information of the player creating the teams.
	 */
	public createTeams( input: CreateTeamsInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createTeams()" );

		this.validateCreateTeams( input, authInfo );

		this.data.config.teamCount = Object.keys( input.data ).length as TeamCount;
		Object.entries( input.data ).forEach( ( [ name, players ] ) => {
			const id = generateId();
			this.data.teamIds.push( id );
			this.data.teams[ id ] = { id, name, players, score: 0, booksWon: [] };
			players.forEach( playerId => {
				this.data.players[ playerId ].teamId = id;
				const teamMates = remove( p => p !== playerId, players );
				this.data.players[ playerId ].teamMates = teamMates;
				this.data.players[ playerId ].opponents = this.data.playerIds.filter( p => !teamMates.includes( p ) );
			} );
		} );

		this.data.status = GAME_STATUS.TEAMS_CREATED;
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
	public startGame( { deckType, type }: StartGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> startGame()" );

		this.validateStartGame( authInfo );

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
		this.logger.debug( "<< startGame()" );
	}

	/**
	 * Handles an ask event where a player requests a card from another player.
	 * This method updates the game state based on the outcome of the ask,
	 * including card ownership and turn management.
	 * @param event - The ask event input containing details of the ask action.
	 * @param authInfo - The authentication information of the player making the ask.
	 */
	public handleAskEvent( event: AskEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> handleAskEvent()" );

		this.validateAskEvent( event, authInfo );

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

		this.logger.debug( "<< handleAskEvent()" );
	}

	/**
	 * Handles a claim event where a player declares they have all cards of a specific book.
	 * This method updates the game state based on the validity of the claim,
	 * including score updates and turn management.
	 * @param event - The claim event input containing details of the claim action.
	 * @param authInfo - The authentication information of the player making the claim.
	 */
	public handleClaimEvent( event: ClaimEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> handleClaimEvent()" );

		this.validateClaimEvent( event, authInfo );

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

		this.logger.debug( "<< handleClaimEvent()" );
	}

	/**
	 * Handles a transfer event where a player transfers their turn to a teammate.
	 * This method updates the game state to reflect the transfer of turn.
	 * @param event - The transfer event input containing details of the transfer action.
	 * @param authInfo - The authentication information of the player making the transfer.
	 */
	public handleTransferEvent( event: TransferEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> handleTransferEvent()" );

		this.validateTransferEvent( event, authInfo );

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

		this.logger.debug( "<< handleTransferEvent()" );
	}

	/**
	 * Retrieves game information specific to a player, including their hand of cards.
	 * @param {PlayerId} playerId - The ID of the player for whom to retrieve game information.
	 * @returns {PlayerGameInfo} - The game information for the specified player, including their hand.
	 */
	public getPlayerGameInfo( playerId: PlayerId ): PlayerGameInfo {
		const { hands, cardMappings, ...rest } = this.data;
		return { ...rest, playerId, hand: hands[ playerId ].map( getCardFromId ) || [] };
	}

	/**
	 * Saves the current game data using the provided save function.
	 * This function is to be called whenever the game state changes and needs to be persisted.
	 */
	public async saveGameData() {
		await this.save( this.data );
	}

	/**
	 * Automates game actions for bot players based on the current game state.
	 * This method checks the game status and performs appropriate actions for bot players,
	 * such as joining the game, creating teams, starting the game, and making moves during their turn.
	 */
	public async autoplay() {
		this.logger.debug( ">> autoplay()" );

		const currentPlayer = this.data.players[ this.data.currentTurn ];
		switch ( this.data.status ) {
			case "CREATED": {
				this.addBots();
				await this.saveGameData();
				break;
			}
			case "PLAYERS_READY": {
				const teamData = FishEngine.getDefaultTeamData( this.data.config.teamCount, this.data.playerIds );
				this.createTeams( { gameId: this.data.id, data: teamData }, currentPlayer );
				await this.saveGameData();
				break;
			}
			case "TEAMS_CREATED": {
				const input: StartGameInput = { type: "NORMAL", deckType: 48, gameId: this.data.id };
				this.startGame( input, currentPlayer );
				await this.saveGameData();
				break;
			}
			case "IN_PROGRESS": {
				if ( currentPlayer.isBot ) {
					const weightedBooks = this.suggestBooks();

					const isLastMoveSuccessfulClaim = this.data.lastMoveType === "claim"
						&& this.data.claimHistory[ 0 ]?.success
						&& this.data.claimHistory[ 0 ]?.playerId === this.data.currentTurn;

					if ( isLastMoveSuccessfulClaim ) {
						const weightedTransfers = this.suggestTransfers( weightedBooks );
						if ( weightedTransfers.length > 0 ) {
							const transferTo = weightedTransfers[ 0 ].transferTo;
							this.logger.info( "Bot %s transferring turn to %s", currentPlayer.id, transferTo );
							const input: TransferEventInput = { gameId: this.data.id, transferTo };
							this.handleTransferEvent( input, currentPlayer );
							await this.saveGameData();
							break;
						}
					}

					this.logger.info( "Bot %s skipping transfer!", currentPlayer.id );

					const weightedClaims = this.suggestClaims( weightedBooks );
					if ( weightedClaims.length > 0 ) {
						const claim = weightedClaims[ 0 ].claim;
						this.logger.info( "Bot %s claiming book with cards: %o", currentPlayer.id, claim );
						const input: ClaimEventInput = { gameId: this.data.id, claim };
						this.handleClaimEvent( input, currentPlayer );
						await this.saveGameData();
						break;
					}

					this.logger.info( "Bot %s skipping claim!", currentPlayer.id );

					const weightedAsks = this.suggestAsks( weightedBooks );
					if ( weightedAsks.length > 0 ) {
						const { playerId, cardId } = weightedAsks[ 0 ];
						this.logger.info( "Bot %s asking %s for card %s", currentPlayer.id, playerId, cardId );
						const event: AskEventInput = { gameId: this.data.id, from: playerId, cardId };
						this.handleAskEvent( event, currentPlayer );
						await this.saveGameData();
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

		this.logger.debug( "<< autoplay()" );
	}

	/**
	 * Suggests possible ask actions for the current player based on their hand and the game state.
	 * @param authInfo - The authentication information of the player for whom to suggest asks.
	 * @throws {Error} error if the game is not in progress or if it's not the player's turn.
	 * @private
	 */
	private validateJoinGame( authInfo: AuthInfo ) {
		this.logger.debug( ">> validateJoinGame()" );


		if ( this.data.players[ authInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", authInfo.id );
			return;
		}

		if ( this.data.playerIds.length >= this.data.config.playerCount ) {
			this.logger.error( "Game Full: %s", this.data.id );
			throw "Game full!";
		}

		this.logger.debug( "<< validateJoinGame()" );
	}

	/**
	 * Validates the input for creating teams, ensuring that the game state and player assignments are correct.
	 * @param input - The input containing team names and their respective player IDs.
	 * @param authInfo - The authentication information of the player creating the teams.
	 * @throws {Error} error if the game is not in the correct state or if the team assignments are invalid.
	 * @private
	 */
	private validateCreateTeams( input: CreateTeamsInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> validateCreateTeams()" );

		const currentPlayer = this.data.players[ this.data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", this.data.id, authInfo.id );
			throw "Not your turn!";
		}

		if ( this.data.status !== GAME_STATUS.PLAYERS_READY ) {
			this.logger.error( "The Game is not in PLAYERS_READY state! GameId: %s", this.data.id );
			throw "The Game is not in PLAYERS_READY state!";
		}

		if ( this.data.playerIds.length !== this.data.config.playerCount ) {
			this.logger.error( "The Game does not have required players! GameId: %s", this.data.id );
			throw "The Game does not have required players!";
		}

		const playersSpecified = new Set( Object.values( input.data ).flat() );
		if ( playersSpecified.size !== this.data.config.playerCount ) {
			this.logger.error( "Not all players are divided into teams! GameId: %s", this.data.id );
			throw "Not all players are divided into teams!";
		}

		const teamCount = Object.keys( input.data ).length;
		const playersPerTeam = this.data.config.playerCount / teamCount;
		for ( const [ teamId, playerIds ] of Object.entries( input.data ) ) {
			if ( playerIds.length !== playersPerTeam ) {
				this.logger.error(
					"The number of players in team does not match the required count! GameId: %s",
					this.data.id
				);
				throw `The number of players in team ${ teamId } does not match the required count!`;
			}

			for ( const playerId of playerIds ) {
				if ( !this.data.players[ playerId ] ) {
					this.logger.error( "Player %s is not part of the game! GameId: %s", playerId, this.data.id );
					throw `Player ${ playerId } is not part of the game!`;
				}
			}
		}

		this.logger.debug( "<< validateCreateTeams()" );
	}

	/**
	 * Validates the conditions required to start the game, ensuring that the game state
	 * and player turn are appropriate.
	 * @param authInfo - The authentication information of the player starting the game.
	 * @throws {Error} error if the game is not in the correct state or if it's not the player's turn.
	 * @private
	 */
	private validateStartGame( authInfo: AuthInfo ) {
		this.logger.debug( ">> validateStartGame()" );

		const currentPlayer = this.data.players[ this.data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", this.data.id, authInfo.id );
			throw "Not your turn!";
		}

		if ( this.data.status !== GAME_STATUS.TEAMS_CREATED ) {
			this.logger.error( "The Game is not in TEAMS_CREATED state! GameId: %s", this.data.id );
			throw "The Game is not in TEAMS_CREATED state!";
		}

		this.logger.debug( "<< validateStartGame()" );
	}

	/**
	 * Validates the conditions required for a player to ask another player for a card,
	 * ensuring that the game state and player turn are appropriate.
	 * @param event - The ask event input containing details of the ask action.
	 * @param authInfo - The authentication information of the player making the ask.
	 * @throws {Error} error if the game is not in progress, if it's not the player's turn,
	 * or if the ask action is invalid. Asked player must be from opposing team and
	 * the asking player must not have the asked card in their hand.
	 * @private
	 */
	private validateAskEvent( event: AskEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> validateAskEvent()" );

		const currentPlayer = this.data.players[ this.data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", this.data.id, authInfo.id );
			throw "Not your turn!";
		}

		const currentPlayerHand = this.data.hands[ this.data.currentTurn ];

		if ( this.data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", this.data.id );
			throw "The Game is not in IN_PROGRESS state!";
		}

		if ( !this.data.players[ event.from ] ) {
			this.logger.error( "Asked player %s is not part of the game! GameId: %s", event.from, this.data.id );
			throw `Asked player ${ event.from } is not part of the game!` ;
		}

		const book = getBookForCard( event.cardId, this.data.config.type );
		if ( !this.data.bookStates[ book ] ) {
			this.logger.error( "Card %s does not exist in the game! GameId: %s", event.cardId, this.data.id );
			throw `Card ${ event.cardId } does not exist in the game!` ;
		}

		if ( isCardInHand( currentPlayerHand.map( getCardFromId ), event.cardId ) ) {
			this.logger.debug( "The asked card is with asking player itself! GameId: %s", this.data.id );
			throw "The asked card is with asking player itself!";
		}

		const askingPlayerTeam = this.data.teams[ this.data.players[ authInfo.id ].teamId ];
		const askedPlayerTeam = this.data.teams[ this.data.players[ event.from ].teamId ];
		if ( askedPlayerTeam === askingPlayerTeam ) {
			this.logger.debug( "The asked player is from the same team! GameId: %s", this.data.id );
			throw "The asked player is from the same team!";
		}

		this.logger.debug( "<< validateAskEvent()" );
	}

	/**
	 * Validates the conditions required for a player to make a claim,
	 * ensuring that the game state and player turn are appropriate.
	 * @param event - The claim event input containing details of the claim action.
	 * @param authInfo - The authentication information of the player making the claim.
	 * @throws {Error} error if the game is not in progress, if it's not the player's turn,
	 * or if the claim action is invalid. Claim must be for all cards of a book and
	 * must include the claiming player. Cards must be from the same book and
	 * must be claimed for players from the same team.
	 * @private
	 */
	private validateClaimEvent( event: ClaimEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> validateDeclareBookEvent()" );

		const currentPlayer = this.data.players[ this.data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", this.data.id, authInfo.id );
			throw "Not your turn!";
		}

		if ( this.data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", this.data.id );
			throw "The Game is not in IN_PROGRESS state!";
		}

		const calledCards = Object.keys( event.claim ).map( key => key as CardId );

		if ( this.data.config.type === "NORMAL" && calledCards.length !== 4 ) {
			this.logger.error( "Normal Fish requires exactly 4 cards to be declared! GameId: %s", this.data.id );
			throw "Normal Fish requires exactly 4 cards to be declared!";
		}

		if ( this.data.config.type === "CANADIAN" && calledCards.length !== 6 ) {
			this.logger.error( "Canadian Fish requires exactly 6 cards to be declared! GameId: %s", this.data.id );
			throw "Canadian Fish requires exactly 6 cards to be declared!";
		}

		for ( const pid of Object.values( event.claim ) ) {
			if ( !this.data.players[ pid ] ) {
				this.logger.error( "Player %s is not part of the game! GameId: %s", pid, this.data.id );
				throw `Player ${ pid } is not part of the game!` ;
			}
		}

		if ( !Object.values( event.claim ).includes( authInfo.id ) ) {
			this.logger.error( "Calling Player did not call own cards! UserId: %s", authInfo.id );
			throw "Calling Player did not call own cards!";
		}

		const calledBooks = calledCards.map( cardId => getBookForCard( cardId, this.data.config.type ) );
		if ( calledBooks.length !== 1 ) {
			this.logger.error( "Cards Called from multiple books! UserId: %s", this.data.currentTurn );
			throw "Cards Called from multiple books!";
		}

		const calledTeams = new Set( Object.values( event.claim ).map( pid => this.data.players[ pid ].teamId ) );
		if ( calledTeams.size !== 1 ) {
			this.logger.error( "Set called from multiple teams! UserId: %s", this.data.currentTurn );
			throw "Set called from multiple teams!";
		}

		this.logger.debug( "<< validateDeclareBookEvent()" );
	}

	/**
	 * Validates the conditions required for a player to transfer their turn to a teammate,
	 * ensuring that the game state and player turn are appropriate.
	 * @param event - The transfer event input containing details of the transfer action.
	 * @param authInfo - The authentication information of the player making the transfer.
	 * @throws {Error} error if the game is not in progress, if it's not the player's turn,
	 * or if the transfer action is invalid. Transfer can only be made after a successful claim
	 * to a player with cards from the same team.
	 * @private
	 */
	private validateTransferEvent( event: TransferEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> validateTransferTurnRequest()" );

		const currentPlayer = this.data.players[ this.data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", this.data.id, authInfo.id );
			throw "Not your turn!";
		}

		if ( this.data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", this.data.id );
			throw "The Game is not in IN_PROGRESS state!";
		}

		const lastClaim = this.data.claimHistory[ 0 ];
		if ( this.data.lastMoveType !== "claim" || !lastClaim || !lastClaim.success ) {
			this.logger.error( "Turn can only be transferred after a successful call!" );
			throw "Turn can only be transferred after a successful call!";
		}

		const transferringPlayer = this.data.players[ this.data.currentTurn ];
		const receivingPlayer = this.data.players[ event.transferTo ];

		if ( !receivingPlayer ) {
			this.logger.error( "The Receiving Player is not part of the Game!" );
			throw "The Receiving Player is not part of the Game!";
		}

		if ( this.data.cardCounts[ event.transferTo ] === 0 ) {
			this.logger.error( "Turn can only be transferred to a player with cards!" );
			throw "Turn can only be transferred to a player with cards!";
		}

		if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
			this.logger.error( "Turn can only be transferred to member of your team!" );
			throw "Turn can only be transferred to member of your team!";
		}

		this.logger.debug( "<< validateTransferTurnRequest()" );
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
		const validBooks = config.books.filter( book => !!bookStates[ book ] );
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
}