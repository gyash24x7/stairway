import type { AuthInfo } from "@/auth/types";
import { CARD_RANKS, SORTED_DECK } from "@/libs/cards/constants";
import type { CardId, CardSet, PlayingCard } from "@/libs/cards/types";
import {
	generateDeck,
	generateHands,
	getAskableCardsOfSet,
	getCardDisplayString,
	getCardFromId,
	getCardId,
	getCardSet,
	getCardsOfSet,
	isCardInHand,
	isCardSetInHand,
	removeCards
} from "@/libs/cards/utils";
import type { Literature } from "@/literature/types";
import { shuffle } from "@/shared/utils/array";
import { generateAvatar, generateGameCode, generateId, generateName } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { DurableObject } from "cloudflare:workers";

/**
 * Durable Object for managing Literature game state.
 * This object handles game creation, joining, and various game actions like asking for cards,
 * calling sets, and transferring turns.
 * It also provides methods for validating game actions and executing bot moves.
 */
export class LiteratureDurableObject extends DurableObject {

	private readonly MAX_ASK_WEIGHT = 720;

	private readonly logger = createLogger( "Literature:DO" );
	private readonly state: DurableObjectState;

	constructor( state: DurableObjectState, env: Env ) {
		super( state, env );
		this.state = state;
	}

	/**
	 * Retrieves game data by game ID.
	 * @param {string} gameId - The ID of the game to retrieve.
	 * @returns {Promise<Literature.GameData>} - A promise that resolves to the game data.
	 */
	async getGameData( gameId: string ): Promise<Literature.GameData> {
		this.logger.debug( ">> getGameData()" );

		const data = await this.state.storage.get<Literature.GameData>( gameId );
		if ( !data ) {
			this.logger.error( "Game Not Found!" );
			throw "Game Not Found!";
		}

		this.logger.debug( "<< getGameData()" );
		return data;
	}

	/**
	 * Retrieves the game store for a specific game ID and authenticated user.
	 * @param {string} gameId - The ID of the game to retrieve the store for.
	 * @param {AuthInfo} authInfo - The authentication information of the user.
	 * @returns {Promise<Literature.Store>} - A promise that resolves to the game store.
	 */
	async getGameStore( gameId: string, authInfo: AuthInfo ): Promise<Literature.Store> {
		this.logger.debug( ">> getGameStore()" );

		const { game, players, teams, lastCall, lastMoveType, asks } = await this.getGameData( gameId );
		const store: Literature.Store = {
			asks: asks.slice( 0, 5 ),
			hand: players[ authInfo.id ].hand,
			lastCall,
			lastMoveType,
			players,
			teams,
			playerId: authInfo.id,
			game
		};

		this.logger.debug( "<< getGameStore()" );
		return store;
	}

	/**
	 * Saves game data to the storage.
	 * @param {string} gameId - The ID of the game to save data for.
	 * @param {Literature.GameData} data - The game data to save.
	 * @returns {Promise<Literature.GameData>} - A promise that resolves to the saved game data.
	 */
	async saveGameData( gameId: string, data: Literature.GameData ): Promise<Literature.GameData> {
		this.logger.debug( ">> saveGameData()" );
		await this.state.storage.put( gameId, data );
		await this.state.storage.put( `code_${ data.game.code }`, gameId );
		this.logger.debug( "<< saveGameData()" );
		return data;
	}

	/**
	 * Retrieves game data by game code.
	 * @param {string} code - The code of the game to retrieve.
	 * @returns {Promise<Literature.GameData>} - A promise that resolves to the game data.
	 */
	async getGameByCode( code: string ): Promise<Literature.GameData> {
		this.logger.debug( ">> getGameByCode()" );

		const gameId = await this.state.storage.get<string>( `code_${ code }` );
		if ( !gameId ) {
			this.logger.error( "Game not found!", code );
			throw "Game not found!";
		}

		const data = await this.getGameData( gameId );
		this.logger.debug( "<< getGameByCode()" );
		return data;
	}

	/**
	 * Creates a new game with the specified player count and authenticated user information.
	 * @param {Literature.CreateGameInput} input - The input containing player count.
	 * @param {AuthInfo} authInfo - The authentication information of the user creating the game.
	 * @returns {Literature.GameData} - The newly created game data.
	 */
	createGame( { playerCount }: Literature.CreateGameInput, authInfo: AuthInfo ): Literature.GameData {
		this.logger.debug( ">> createGame()" );

		const data: Literature.GameData = {
			game: {
				id: generateId(),
				code: generateGameCode(),
				playerCount: playerCount ?? 6,
				status: "CREATED",
				currentTurn: authInfo.id
			},
			players: {
				[ authInfo.id ]: this.getPlayerInfo( authInfo )
			},
			teams: {},
			cardMappings: this.getDefaultCardMappings(),
			cardLocations: this.getDefaultCardLocations(),
			asks: [],
			calls: [],
			transfers: []
		};

		this.logger.debug( "<< createGame()" );
		return data;
	}

	/**
	 * Joins a game with the specified game data and authenticated user information.
	 * @param {Literature.GameData} data - The game data to join.
	 * @param {AuthInfo} authInfo - The authentication information of the user joining the game.
	 * @returns {Literature.GameData} - The updated game data after joining.
	 */
	joinGame( data: Literature.GameData, authInfo: AuthInfo ): Literature.GameData {
		this.logger.debug( ">> joinGame()" );

		const isUserAlreadyInGame = !!Object.values( data.players ).find( player => player.id === authInfo.id );
		if ( isUserAlreadyInGame ) {
			return data;
		}

		data.players[ authInfo.id ] = {
			id: authInfo.id,
			name: authInfo.name,
			avatar: authInfo.avatar,
			isBot: false,
			hand: [],
			cardCount: 0,
			metrics: this.getDefaultMetrics()
		};

		if ( data.game.playerCount === Object.keys( data.players ).length ) {
			data.game.status = "PLAYERS_READY";
		}

		this.logger.debug( "<< joinGame()" );
		return data;
	}

	/**
	 * Adds bots to the game based on the player count and existing players.
	 * @param {Literature.GameData} data - The game data to add bots to.
	 * @returns {Literature.GameData} - The updated game data after adding bots.
	 */
	addBots( data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> addBots()" );

		const botCount = data.game.playerCount - Object.keys( data.players ).length;
		for ( let i = 0; i < botCount; i++ ) {
			const bot = {
				id: generateId(),
				name: generateName(),
				avatar: generateAvatar(),
				isBot: true,
				hand: [],
				cardCount: 0,
				cardLocations: [],
				metrics: this.getDefaultMetrics()
			};
			data.players[ bot.id ] = bot;
		}

		data.game.status = "PLAYERS_READY";
		this.logger.debug( "<< addBots()" );
		return data;
	}

	/**
	 * Creates teams based on the input data and updates the game data.
	 * @param {Literature.CreateTeamsInput} input - The input containing team data.
	 * @param {Literature.GameData} data - The game data to update with teams.
	 * @returns {Literature.GameData} - The updated game data after creating teams.
	 */
	createTeams( input: Literature.CreateTeamsInput, data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> createTeams()" );

		data.teams = Object.keys( input.data )
			.map( name => {
				const team = { id: generateId(), name, members: input.data[ name ], score: 0, setsWon: [] };
				team.members.forEach( memberId => {
					data.players[ memberId ].teamId = team.id;
				} );
				return team;
			} )
			.reduce(
				( acc, team ) => {
					acc[ team.id ] = team;
					return acc;
				},
				{} as Literature.TeamData
			);

		data.game.status = "TEAMS_CREATED";
		this.logger.debug( "<< createTeams()" );
		return data;
	}

	/**
	 * Starts the game by initializing player hands and card mappings.
	 * @param {Literature.GameData} data - The game data to start.
	 * @returns {Literature.GameData} - The updated game data after starting the game.
	 */
	startGame( data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> startGame()" );

		const deck = removeCards( card => card.rank === CARD_RANKS.SEVEN, generateDeck() );
		const playerIds = Object.keys( data.players );
		const hands = generateHands( deck, data.game.playerCount );

		this.logger.info( "Starting game with playerIds: %o", playerIds );

		playerIds.forEach( ( playerId, index ) => {
			const hand = hands[ index ];
			data.players[ playerId ].hand = hand;
			data.players[ playerId ].cardCount = 48 / data.game.playerCount;

			hand.forEach( card => {
				data.cardMappings[ getCardId( card ) ] = playerId;
			} );

			const otherPlayerIds = playerIds.filter( id => id !== playerId );
			deck.forEach( c => {
				const cardId = getCardId( c );
				if ( !data.cardLocations[ cardId ] ) {
					data.cardLocations[ cardId ] = {};
				}

				if ( isCardInHand( hand, c ) ) {
					data.cardLocations[ cardId ][ playerId ] = { playerIds: [ playerId ], weight: 0 };
				}

				const weight = this.MAX_ASK_WEIGHT / otherPlayerIds.length;
				data.cardLocations[ cardId ][ playerId ] = { playerIds: otherPlayerIds, weight };
			} );
		} );

		data.game.status = "IN_PROGRESS";
		this.logger.debug( "<< startGame()" );
		return data;
	}

	/**
	 * Asks for a card from another player and updates the game state accordingly.
	 * @param {Literature.AskCardInput} input - The input containing the card and player information.
	 * @param {Literature.GameData} data - The game data to update with the ask action.
	 * @returns {Literature.GameData} - The updated game data after the ask action.
	 */
	askCard( input: Literature.AskCardInput, data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> askCard()" );

		const askedPlayer = data.players[ input.from ];
		const playerWithAskedCard = data.players[ data.cardMappings[ input.card ] ];
		const askedCard = getCardFromId( input.card );
		const currentPlayer = data.players[ data.game.currentTurn ];

		const success = askedPlayer.id === playerWithAskedCard.id;
		const receivedString = success ? "got the card!" : "was declined!";
		const cardDisplayString = getCardDisplayString( askedCard );
		const description = `${ currentPlayer.name } asked ${ askedPlayer.name } for ${ cardDisplayString } and ${ receivedString }`;

		const ask: Literature.Ask = {
			id: generateId(),
			playerId: currentPlayer.id,
			success,
			description,
			cardId: input.card,
			askedFrom: input.from,
			timestamp: new Date()
		};

		const nextTurn = !ask.success ? ask.askedFrom : ask.playerId;
		if ( nextTurn !== data.game.currentTurn ) {
			data.game.currentTurn = nextTurn;
		}

		if ( ask.success ) {
			data.cardMappings[ ask.cardId ] = ask.playerId;
			data.players[ ask.playerId ].hand.push( askedCard );
			data.players[ ask.playerId ].cardCount++;

			data.players[ ask.askedFrom ].cardCount--;
			data.players[ ask.askedFrom ].hand = removeCards(
				card => getCardId( card ) === ask.cardId,
				data.players[ ask.askedFrom ].hand
			);
		}

		Object.keys( data.cardLocations[ ask.cardId ] ).map( playerId => {
			const cl = data.cardLocations[ ask.cardId ][ playerId ];

			if ( ask.success ) {
				cl.weight = ask.playerId === playerId ? 0 : this.MAX_ASK_WEIGHT;
				cl.playerIds = [ ask.playerId ];
			} else {
				cl.playerIds = cl.playerIds.filter( p => p !== ask.playerId && p !== ask.askedFrom );
				cl.weight = this.MAX_ASK_WEIGHT / cl.playerIds.length;
			}

			data.cardLocations[ ask.cardId ][ playerId ] = cl;
		} );

		data.lastMoveType = "ASK";
		data.lastCall = undefined;
		data.asks.unshift( ask );

		this.logger.debug( "<< askCard()" );
		return data;
	}

	/**
	 * Calls a set of cards and updates the game state accordingly.
	 * @param {Literature.CallSetInput} input - The input containing the called set and player information.
	 * @param {Literature.GameData} data - The game data to update with the call action.
	 * @returns {Literature.GameData} - The updated game data after the call action.
	 */
	callSet( input: Literature.CallSetInput, data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> callSet()" );

		const cardSets = new Set( Object.keys( input.data ).map( key => key as CardId ).map( getCardSet ) );
		const { correctCall, calledSet } = this.getCorrectCallAndCalledSet( Array.from( cardSets ), input, data );
		const callingPlayer = data.players[ data.game.currentTurn ]!;

		let success = true;
		let successString = "correctly!";

		for ( const card of getCardsOfSet( calledSet ) ) {
			const cardId = getCardId( card );
			if ( correctCall[ cardId ] !== input.data[ cardId ] ) {
				success = false;
				successString = "incorrectly!";
				break;
			}
		}

		const call: Literature.Call = {
			id: generateId(),
			playerId: callingPlayer.id,
			success,
			description: `${ callingPlayer.name } called ${ calledSet } ${ successString }`,
			cardSet: calledSet,
			actualCall: input.data,
			correctCall,
			timestamp: new Date()
		};

		Object.keys( correctCall ).map( key => key as CardId ).forEach( ( cardId ) => {
			const playerWithCard = data.cardMappings[ cardId ];
			data.players[ playerWithCard ].hand = removeCards(
				card => getCardId( card ) === cardId,
				data.players[ playerWithCard ].hand
			);
			data.players[ playerWithCard ].cardCount--;

			delete data.cardMappings[ cardId ];
			delete data.cardLocations[ cardId ];
		} );

		let winningTeamId = callingPlayer.teamId!;

		if ( !success ) {
			[ winningTeamId ] = Object.keys( data.teams ).filter( teamId => teamId !== winningTeamId );
		}

		data.teams[ winningTeamId ].score++;
		data.teams[ winningTeamId ].setsWon.push( calledSet );

		const setsCompleted: CardSet[] = [ calledSet ];
		Object.values( data.teams ).forEach( team => {
			setsCompleted.push( ...team.setsWon );
		} );

		this.logger.debug( "SetsCompleted: %o", setsCompleted );

		if ( setsCompleted.length === 8 ) {
			data.game.status = "COMPLETED";
		} else {

			let nextTurn: string;
			const playersWithCards = shuffle( Object.values( data.players ) )
				.filter( player => player.cardCount !== 0 );

			const oppositeTeamPlayersWithCards = playersWithCards.filter( p => p.teamId !== callingPlayer.teamId );
			const teamPlayersWithCards = playersWithCards.filter( p => p.teamId === callingPlayer.teamId );

			if ( success ) {
				if ( callingPlayer.cardCount !== 0 ) {
					nextTurn = callingPlayer.id;
				} else {
					if ( teamPlayersWithCards.length !== 0 ) {
						nextTurn = teamPlayersWithCards[ 0 ].id;
					} else {
						nextTurn = oppositeTeamPlayersWithCards[ 0 ].id;
					}
				}
			} else {
				if ( oppositeTeamPlayersWithCards.length !== 0 ) {
					nextTurn = oppositeTeamPlayersWithCards[ 0 ].id;
				} else {
					if ( teamPlayersWithCards.length > 0 ) {
						nextTurn = teamPlayersWithCards[ 0 ].id;
					} else {
						nextTurn = callingPlayer.id;
					}
				}
			}

			if ( nextTurn !== data.game.currentTurn ) {
				data.game.currentTurn = nextTurn;
			}
		}

		data.lastMoveType = "CALL";
		data.lastCall = call;
		data.calls.unshift( call );

		this.logger.debug( "<< callSet()" );
		return data;
	}

	/**
	 * Transfers the turn to another player and updates the game state accordingly.
	 * @param {Literature.TransferTurnInput} input - The input containing transfer information.
	 * @param {Literature.GameData} data - The game data to update with the transfer action.
	 * @returns {Literature.GameData} - The updated game data after the transfer action.
	 */
	transferTurn( input: Literature.TransferTurnInput, data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> transferTurn()" );

		const transferringPlayer = data.players[ data.game.currentTurn ];
		const receivingPlayer = data.players[ input.transferTo ];
		const transfer: Literature.Transfer = {
			id: generateId(),
			playerId: transferringPlayer.id,
			description: `${ transferringPlayer.name } transferred the turn to ${ receivingPlayer.name }`,
			transferTo: input.transferTo,
			timestamp: new Date()
		};

		data.game.currentTurn = input.transferTo;
		data.lastMoveType = "TRANSFER";
		data.lastCall = undefined;
		data.transfers.unshift( transfer );

		this.logger.debug( "<< transferTurn()" );
		return data;
	}

	/**
	 * Executes a bot move based on the current game state and returns the updated game data.
	 * This method simulates a bot's turn by suggesting card sets, making calls, and asking for cards.
	 * It first checks if the last move was a successful call, allowing the bot to transfer its turn.
	 * If no transfer is made, it suggests card sets and attempts to call a set.
	 * If no call is made, it suggests asking for a card from another player.
	 *
	 * @param {Literature.GameData} data - The current game data.
	 * @returns {Literature.GameData} - The updated game data after executing the bot move.
	 */
	executeBotMove( data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> executeBotMove()" );

		const cardSets = this.suggestCardSets( data.cardLocations, data.players[ data.game.currentTurn ].hand );

		if ( !!data.lastCall?.success && data.lastCall.playerId === data.game.currentTurn ) {
			this.logger.info( "Last Move was a successful call! Can transfer chance!" );

			const transfers = this.suggestTransfer( data );
			if ( transfers.length > 0 ) {
				data = this.transferTurn( { transferTo: transfers[ 0 ].transferTo, gameId: data.game.id }, data );
				this.logger.debug( "<< executeBotMove()" );
				return data;
			}
		}

		const calls = this.suggestCalls( cardSets, data );
		if ( calls.length > 0 ) {
			data = this.callSet( { gameId: data.game.id, data: calls[ 0 ].callData }, data );
			this.logger.debug( "<< executeBotMove()" );
			return data;
		}

		const asks = this.suggestAsks( cardSets, data );
		if ( asks.length === 0 ) {
			this.logger.error( "No Valid Move Found!" );
		}

		const [ bestAsk ] = asks;
		data = this.askCard( { from: bestAsk.playerId, card: bestAsk.cardId, gameId: data.game.id }, data );

		this.logger.debug( "<< executeBotMove()" );
		return data;
	}

	/**
	 * Validates the game data for joining a game.
	 * This method checks if the game is in the CREATED state,
	 * if the user is already part of the game,
	 * and if the game has enough players to allow joining.
	 *
	 * @param {Literature.GameData} data - The game data to validate.
	 * @param {AuthInfo} authInfo - The authentication information of the user joining the game.
	 * @returns {Literature.GameData} - The validated game data.
	 */
	validateJoinGame( data: Literature.GameData, authInfo: AuthInfo ): Literature.GameData {
		this.logger.debug( ">> validateJoinGame()" );

		if ( data.game.status !== "CREATED" ) {
			this.logger.error( "The Game is not in CREATED state! GameId: %s", data.game.id );
			throw "The Game is not in CREATED state!";
		}

		const isUserAlreadyInGame = !!Object.values( data.players ).find( player => player.id === authInfo.id );
		if ( isUserAlreadyInGame ) {
			this.logger.warn( "The User is already part of the Game! GameId: %s", data.game.id );
			return data;
		}

		if ( Object.keys( data.players ).length >= data.game.playerCount ) {
			this.logger.error( "The Game already has required players! GameId: %s", data.game.id );
			throw "The Game already has required players!";
		}

		this.logger.debug( "<< validateJoinGame()" );
		return data;
	}

	/**
	 * Validates the game data for adding bots.
	 * This method checks if the game is in the CREATED state and if there are remaining players to be added.
	 *
	 * @param {Literature.GameData} data - The game data to validate for adding bots.
	 * @returns {Literature.GameData} - The validated game data.
	 */
	validateAddBots( data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> validateAddBotsRequest()" );

		if ( data.game.status !== "CREATED" ) {
			this.logger.error( "The Game is not in CREATED state! GameId: %s", data.game.id );
			throw "The Game is not in CREATED state!";
		}

		const remainingPlayers = data.game.playerCount - Object.keys( data.players ).length;
		if ( remainingPlayers <= 0 ) {
			this.logger.error( "The Game already has required players! GameId: %s", data.game.id );
			throw "The Game already has required players!";
		}

		this.logger.debug( "<< validateAddBotsRequest()" );
		return data;
	}

	/**
	 * Validates the game data for creating teams.
	 * This method checks if the game is in the PLAYERS_READY state and if there are enough players to form teams.
	 *
	 * @param {Literature.GameData} data - The game data to validate for creating teams.
	 * @returns {Literature.GameData} - The validated game data.
	 */
	validateCreateTeams( data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> validateCreateTeamsRequest()" );

		if ( data.game.status !== "PLAYERS_READY" ) {
			this.logger.error( "The Game is not in PLAYERS_READY state! GameId: %s", data.game.id );
			throw "The Game is not in PLAYERS_READY state!";
		}

		if ( Object.keys( data.players ).length !== data.game.playerCount ) {
			this.logger.error( "The Game doesn't have enough players! GameId: %s", data.game.id );
			throw "The Game doesn't have enough players!";
		}

		this.logger.debug( "<< validateCreateTeamsRequest()" );
		return data;
	}

	/**
	 * Validates the game data for starting the game.
	 * This method checks if the game is in the TEAMS_CREATED state before starting.
	 *
	 * @param {Literature.GameData} data - The game data to validate for starting the game.
	 * @returns {Literature.GameData} - The validated game data.
	 */
	validateStartGame( data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> validateStartGameRequest()" );

		if ( data.game.status !== "TEAMS_CREATED" ) {
			this.logger.error( "The Game is not in TEAMS_CREATED state! GameId: %s", data.game.id );
			throw "The Game is not in TEAMS_CREATED state!";
		}

		this.logger.debug( "<< validateStartGameRequest()" );
		return data;
	}

	/**
	 * Validates the ask card request.
	 * This method checks if the game is in progress, if the card is part of the game,
	 * if the asked player exists, and if the asked player is not from the same team as the asking player.
	 *
	 * @param {Literature.AskCardInput} input - The input containing card and player information.
	 * @param {Literature.GameData} data - The game data to validate against.
	 * @returns {Literature.GameData} - The validated game data.
	 */
	validateAskCard( input: Literature.AskCardInput, data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> validateAskCardRequest()" );

		if ( data.game.status !== "IN_PROGRESS" ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.game.id );
			throw "The Game is not in IN_PROGRESS state!";
		}

		if ( !Object.keys( data.cardMappings ).includes( input.card ) ) {
			this.logger.error( "Card Not Part of Game! GameId: %s CardId: %s", data.game.id, input.card );
			throw "Card Not Part of Game!";
		}

		const askedPlayer = data.players[ input.from ];
		const playerWithAskedCard = data.players[ data.cardMappings[ input.card ] ];

		if ( !askedPlayer ) {
			this.logger.debug(
				"The Player is not part of the Game! GameId: %s, PlayerId: %s",
				data.game.id,
				input.from
			);
			throw "The Player is not part of the Game!";
		}

		if ( playerWithAskedCard.id === data.game.currentTurn ) {
			this.logger.debug( "The asked card is with asking player itself! GameId: %s", data.game.id );
			throw "The asked card is with asking player itself!";
		}

		if ( data.players[ data.game.currentTurn ].teamId === askedPlayer.teamId ) {
			this.logger.debug( "The asked player is from the same team! GameId: %s", data.game.id );
			throw "The asked player is from the same team!";
		}

		this.logger.debug( "<< validateAskCardRequest()" );
		return data;
	}

	/**
	 * Validates the call set request.
	 * This method checks if the game is in progress, if the called cards are from a single set,
	 * if the calling player has called their own cards, and if all cards of the set are called.
	 *
	 * @param {Literature.CallSetInput} input - The input containing called cards and player information.
	 * @param {Literature.GameData} data - The game data to validate against.
	 * @returns {Literature.GameData} - The validated game data.
	 */
	validateCallSet( input: Literature.CallSetInput, data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> validateCallSetRequest()" );

		if ( data.game.status !== "IN_PROGRESS" ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.game.id );
			throw "The Game is not in IN_PROGRESS state!";
		}

		const calledCards = Object.keys( input.data ).map( key => key as CardId ).map( getCardFromId );
		const cardSets = new Set( calledCards.map( getCardSet ) );

		const calledPlayers = Array.from( new Set( Object.values( input.data ) ) ).map( playerId => {
			const player = data.players[ playerId ];
			if ( !player ) {
				this.logger.error(
					"The Player is not part of the Game! GameId: %s, PlayerId: %s",
					data.game.id,
					playerId
				);
				throw "The Player is not part of the Game!";
			}
			return player;
		} );

		if ( !Object.values( input.data ).includes( data.game.currentTurn ) ) {
			this.logger.error( "Calling Player did not call own cards! UserId: %s", data.game.currentTurn );
			throw "Calling Player did not call own cards!";
		}

		if ( cardSets.size !== 1 ) {
			this.logger.error( "Cards Called from multiple sets! UserId: %s", data.game.currentTurn );
			throw "Cards Called from multiple sets!";
		}

		const { isCardSetWithCallingPlayer, calledSet } = this.getCorrectCallAndCalledSet(
			Array.from( cardSets ), input, data
		);

		if ( !isCardSetWithCallingPlayer ) {
			this.logger.error(
				"Set called without cards from that set! UserId: %s, Set: %s",
				data.game.currentTurn,
				calledSet
			);
			throw "Set called without cards from that set!";
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.error( "Set called from multiple teams! UserId: %s", data.game.currentTurn );
			throw "Set called from multiple teams!";
		}

		if ( calledCards.length !== 6 ) {
			this.logger.error(
				"All Cards not called for the set! UserId: %s, Set: %s",
				data.game.currentTurn,
				calledSet
			);
			throw "All Cards not called for the set!";
		}

		this.logger.debug( "<< validateCallSetRequest()" );
		return data;
	}

	/**
	 * Validates the transfer turn request.
	 * This method checks if the game is in progress, if the last call was successful,
	 * if the receiving player exists, if they have cards, and if they are from the same team.
	 *
	 * @param {Literature.TransferTurnInput} input - The input containing transfer information.
	 * @param {Literature.GameData} data - The game data to validate against.
	 * @returns {Literature.GameData} - The validated game data.
	 */
	validateTransferTurn( input: Literature.TransferTurnInput, data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> validateTransferTurnRequest()" );

		if ( data.game.status !== "IN_PROGRESS" ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.game.id );
			throw "The Game is not in IN_PROGRESS state!";
		}

		if ( !data.lastCall ) {
			this.logger.error( "Turn can only be transferred after a successful call!" );
			throw "Turn can only be transferred after a successful call!";
		}

		const transferringPlayer = data.players[ data.game.currentTurn ];
		const receivingPlayer = data.players[ input.transferTo ];

		if ( !receivingPlayer ) {
			this.logger.error( "The Receiving Player is not part of the Game!" );
			throw "The Receiving Player is not part of the Game!";
		}

		if ( data.players[ input.transferTo ].cardCount === 0 ) {
			this.logger.error( "Turn can only be transferred to a player with cards!" );
			throw "Turn can only be transferred to a player with cards!";
		}

		if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
			this.logger.error( "Turn can only be transferred to member of your team!" );
			throw "Turn can only be transferred to member of your team!";
		}

		this.logger.debug( "<< validateTransferTurnRequest()" );
		return data;
	}

	/**
	 * Validates the bot move execution request.
	 * This method checks if the game is in progress and if the current player is a bot.
	 *
	 * @param {Literature.GameData} data - The game data to validate for executing a bot move.
	 * @returns {Literature.GameData} - The validated game data.
	 */
	validateExecuteBotMove( data: Literature.GameData ): Literature.GameData {
		this.logger.debug( ">> validateExecuteBotMove()" );

		if ( data.game.status !== "IN_PROGRESS" ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.game.id );
			throw "The Game is not in IN_PROGRESS state!";
		}

		if ( !data.players[ data.game.currentTurn ].isBot ) {
			this.logger.error( "Cannot execute bot move for a non-bot player! UserId: %s", data.game.currentTurn );
			throw "Cannot execute bot move for a non-bot player!";
		}

		this.logger.debug( "<< validateExecuteBotMove()" );
		return data;
	}

	/**
	 * Retrieves player information based on the authenticated user's information.
	 * @param {AuthInfo} authInfo - The authentication information of the user.
	 * @returns {Literature.Player} - The player information object.
	 * @private
	 */
	private getPlayerInfo( authInfo: AuthInfo ): Literature.Player {
		return {
			id: authInfo.id,
			name: authInfo.name,
			avatar: authInfo.avatar,
			isBot: false,
			hand: [],
			cardCount: 0,
			metrics: this.getDefaultMetrics()
		};
	}

	/**
	 * Generates default card mappings for the game.
	 * @returns {Literature.CardMappings} - The default card mappings object.
	 * @private
	 */
	private getDefaultCardMappings(): Literature.CardMappings {
		return SORTED_DECK.reduce(
			( acc, card ) => {
				const cardId = getCardId( card );
				acc[ cardId ] = "";
				return acc;
			},
			{} as Literature.CardMappings
		);
	}

	/**
	 * Generates default card locations for the game.
	 * @returns {Literature.CardLocationData} - The default card locations object.
	 * @private
	 */
	private getDefaultCardLocations(): Literature.CardLocationData {
		return SORTED_DECK.reduce(
			( acc, card ) => {
				const cardId = getCardId( card );
				acc[ cardId ] = {};
				return acc;
			},
			{} as Literature.CardLocationData
		);
	}

	/**
	 * Generates default metrics for a player.
	 * @returns {Literature.Metrics} - The default metrics object.
	 * @private
	 */
	private getDefaultMetrics(): Literature.Metrics {
		return {
			totalAsks: 0,
			cardsTaken: 0,
			cardsGiven: 0,
			totalCalls: 0,
			successfulCalls: 0,
			totalTransfers: 0
		};
	}

	/**
	 * Retrieves the correct call and called set based on the input data and game data.
	 * @param {CardSet[]} cardSets - The card sets available in the game.
	 * @param {Literature.CallSetInput} input - The input containing called cards and player information.
	 * @param {Literature.GameData} data - The game data to validate against.
	 * @returns {{ correctCall: Record<CardId, string>, calledSet: CardSet, isCardSetWithCallingPlayer: boolean }} - The correct call, called set, and whether the calling player has cards in the called set.
	 * @private
	 */
	private getCorrectCallAndCalledSet(
		cardSets: CardSet[],
		input: Literature.CallSetInput,
		data: Literature.GameData
	): { correctCall: Record<CardId, string>; calledSet: CardSet; isCardSetWithCallingPlayer: boolean; } {
		const [ calledSet ] = cardSets;
		let isCardSetWithCallingPlayer = false;

		const correctCall = Object.keys( input.data ).map( key => key as CardId ).reduce( ( acc, cardId ) => {
			const playerId = data.cardMappings[ cardId ];
			if ( playerId === data.game.currentTurn ) {
				isCardSetWithCallingPlayer = true;
			}
			acc[ cardId ] = playerId;
			return acc;
		}, {} as Record<CardId, string> );

		return { correctCall, calledSet, isCardSetWithCallingPlayer };
	}

	/**
	 * Suggests card sets based on the current card locations and player's hand.
	 * It calculates the weight of each card set based on the number of cards available in the game.
	 * @param {Literature.CardLocationData} cardLocations - The current card locations in the game.
	 * @param {PlayingCard[]} hand - The player's hand of cards.
	 * @returns {CardSet[]} - An array of suggested card sets that can be called.
	 * @private
	 */
	private suggestCardSets( cardLocations: Literature.CardLocationData, hand: PlayingCard[] ): CardSet[] {
		const weightedCardSets: Literature.WeightedCardSet[] = [];
		const cardSetsInGame = new Set( Object.keys( cardLocations ).map( key => key as CardId ).map( getCardSet ) );

		for ( const cardSet of cardSetsInGame ) {
			let weight = 0;

			for ( const card of getCardsOfSet( cardSet ) ) {
				const cardLocation = cardLocations[ getCardId( card ) ];
				if ( !cardLocation || Object.keys( cardLocation ).length === 0 ) {
					continue;
				}

				weight += this.MAX_ASK_WEIGHT / Object.keys( cardLocation ).length;
			}

			weightedCardSets.push( { cardSet, weight } );
		}

		this.logger.info( "Weighted CardSets: %o", weightedCardSets.sort( ( a, b ) => b.weight - a.weight ) );

		return weightedCardSets.map( w => w.cardSet ).filter( ( cardSet ) => isCardSetInHand( hand, cardSet ) );
	}

	/**
	 * Suggests transfers based on the current game state.
	 * It calculates the weight of each transfer based on the number of cards held by team members.
	 * @param {Literature.GameData} data - The current game data.
	 * @returns {Literature.WeightedTransfer[]} - An array of suggested transfers with weights.
	 * @private
	 */
	private suggestTransfer( { game, players }: Literature.GameData ): Literature.WeightedTransfer[] {
		const teamId = players[ game.currentTurn ].teamId;
		const myTeamMembers = Object.values( players )
			.filter( player => player.teamId === teamId && player.id !== game.currentTurn && player.cardCount > 0 )
			.map( player => player.id );

		const weightedTransfers = myTeamMembers.map( transferTo => {
			return { weight: 720 / myTeamMembers.length + players[ transferTo ].cardCount, transferTo };
		} );

		this.logger.debug( "Weighted Transfers: %o", weightedTransfers );
		return weightedTransfers.toSorted( ( a, b ) => b.weight - a.weight );
	}

	/**
	 * Checks if a card set can be called based on the current game state.
	 * It verifies if the calling player has cards from the set and if the set is with their team.
	 * @param {CardSet} cardSet - The card set to check.
	 * @param {Literature.GameData} data - The current game data.
	 * @returns {[boolean, Record<string, string[]>]} - A tuple containing a boolean indicating if the card set can be called and a map of card possibilities.
	 * @private
	 */
	private canCardSetBeCalled(
		cardSet: CardSet,
		{ game, players, cardLocations }: Literature.GameData
	): [ boolean, Record<string, string[]> ] {
		const currentPlayer = players[ game.currentTurn ];
		const oppositeTeamMembers = Object.values( players )
			.filter( player => player.teamId !== currentPlayer.teamId )
			.map( player => player.id );

		const cardPossibilityMap: Record<string, string[]> = {};
		let isCardSetWithUs = true;

		for ( const card of shuffle( getCardsOfSet( cardSet ) ) ) {

			const cardId = getCardId( card );
			if ( isCardInHand( currentPlayer.hand, card ) ) {
				cardPossibilityMap[ cardId ] = [ game.currentTurn ];
				continue;
			}

			if ( !cardLocations[ cardId ] || Object.keys( cardLocations[ cardId ] ).length === 0 ) {
				continue;
			}

			cardPossibilityMap[ cardId ] = Object.keys( cardLocations[ cardId ] );
			Object.keys( cardLocations[ cardId ] )
				.filter( playerId => players[ playerId ].cardCount > 0 )
				.forEach( playerId => {
					if ( oppositeTeamMembers.includes( playerId ) ) {
						isCardSetWithUs = false;
					}
				} );
		}

		const totalCardsCalled = Object.keys( cardPossibilityMap ).length;
		const canCardSetBeCalled = isCardSetWithUs && totalCardsCalled === 6;

		return [ canCardSetBeCalled, cardPossibilityMap ] as const;
	}

	/**
	 * Suggests calls based on the card sets available in the game.
	 * It calculates the weight of each call based on the number of players who can be called for each card.
	 * @param {CardSet[]} cardSetsInGame - The card sets available in the game.
	 * @param {Literature.GameData} data - The current game data.
	 * @returns {Literature.WeightedCall[]} - An array of suggested calls with weights.
	 * @private
	 */
	private suggestCalls( cardSetsInGame: CardSet[], data: Literature.GameData ): Literature.WeightedCall[] {
		const weightedCalls: Literature.WeightedCall[] = [];
		this.logger.info( "CardSets in Game: %o", cardSetsInGame );

		for ( const cardSet of cardSetsInGame ) {

			const [ canCardSetBeCalledValue, cardPossibilityMap ] = this.canCardSetBeCalled( cardSet, data );
			if ( !canCardSetBeCalledValue ) {
				this.logger.info( "This card set is not with my team. Cannot Call! CardSet: %s", cardSet );
				continue;
			}

			const totalPossiblePlayers = Object.values( cardPossibilityMap ).flat().length;
			let weight = this.MAX_ASK_WEIGHT;

			if ( totalPossiblePlayers > 6 ) {
				weight /= totalPossiblePlayers - 6;
			}

			const callData: Record<string, string> = {};
			for ( const card of shuffle( getCardsOfSet( cardSet ) ) ) {
				const cardId = getCardId( card );
				const callablePlayersForCard = cardPossibilityMap[ cardId ]
					.filter( playerId => data.players[ playerId ].cardCount > 0 );

				const randIdx = Math.floor( Math.random() * callablePlayersForCard.length );
				callData[ cardId ] = callablePlayersForCard[ randIdx ];
			}

			weightedCalls.push( { callData, weight, cardSet } );
		}

		this.logger.debug( "Weighted Calls: %o", weightedCalls );
		return weightedCalls.toSorted( ( a, b ) => b.weight - a.weight );
	}

	/**
	 * Suggests asks based on the card sets available in the player's hand.
	 * It calculates the weight of each ask based on the number of players who can be asked for each card.
	 * @param {CardSet[]} cardSets - The card sets available in the player's hand.
	 * @param {Literature.GameData} data - The current game data.
	 * @returns {Literature.WeightedAsk[]} - An array of suggested asks with weights.
	 * @private
	 */
	private suggestAsks(
		cardSets: CardSet[],
		{ game, players, cardLocations }: Literature.GameData
	): Literature.WeightedAsk[] {
		const currentPlayer = players[ game.currentTurn ];
		const oppositeTeamMembers = Object.values( players )
			.filter( player => player.teamId !== currentPlayer.teamId )
			.map( player => player.id );

		const weightedAskMap: Record<string, Literature.WeightedAsk[]> = {};
		const weightedAsks: Literature.WeightedAsk[] = [];

		for ( const cardSet of cardSets ) {
			if ( !isCardSetInHand( currentPlayer.hand, cardSet ) ) {
				continue;
			}

			const cardsOfSet = shuffle( getAskableCardsOfSet( currentPlayer.hand, cardSet ) );
			weightedAskMap[ cardSet ] = [];

			for ( const card of cardsOfSet ) {

				const cardId = getCardId( card );
				if ( !cardLocations[ cardId ] || Object.keys( cardLocations[ cardId ] ).length === 0 ) {
					continue;
				}

				const possibleAsks: Literature.WeightedAsk[] = Object.keys( cardLocations[ cardId ] )
					.filter( playerId => oppositeTeamMembers.includes( playerId ) )
					.filter( playerId => players[ playerId ].cardCount > 0 )
					.map( playerId => {
						const weight = this.MAX_ASK_WEIGHT / Object.keys( cardLocations[ cardId ] ).length;
						return { cardId, playerId, weight };
					} );

				weightedAskMap[ cardSet ].push( ...shuffle( possibleAsks ) );
			}

			weightedAskMap[ cardSet ].sort( ( a, b ) => b.weight - a.weight );
			weightedAsks.push( ...weightedAskMap[ cardSet ] );
		}

		return weightedAsks;
	}
}