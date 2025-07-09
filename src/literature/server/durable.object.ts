import type { AuthInfo } from "@/auth/types";
import { CARD_RANKS, SORTED_DECK } from "@/libs/cards/constants";
import type { CardId, CardSet } from "@/libs/cards/types";
import {
	generateDeck,
	generateHands,
	getCardDisplayString,
	getCardFromId,
	getCardId,
	getCardsOfSet,
	isCardInHand,
	removeCards
} from "@/libs/cards/utils";
import { suggestAsks, suggestCalls, suggestCardSets, suggestTransfer } from "@/literature/server/bot.service";
import type {
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	GameIdInput,
	JoinGameInput,
	TransferTurnInput
} from "@/literature/server/inputs";
import {
	validateAddBots,
	validateAskCard,
	validateCallSet,
	validateCreateTeams,
	validateJoinGame,
	validateTransferTurn
} from "@/literature/server/validators";
import type { Literature } from "@/literature/types";
import { shuffle } from "@/shared/utils/array";
import { generateAvatar, generateGameCode, generateId, generateName } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { DurableObject } from "cloudflare:workers";

export class LiteratureDurableObject extends DurableObject {

	private readonly MAX_ASK_WEIGHT = 720;

	private readonly logger = createLogger( "Literature:DO" );
	private readonly state: DurableObjectState;

	constructor( state: DurableObjectState, env: Env ) {
		super( state, env );
		this.state = state;
	}

	async getGameData( gameId: string ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.state.storage.get<Literature.GameData>( gameId );
		if ( !data ) {
			this.logger.error( "Game Not Found!" );
			throw "Game Not Found!";
		}

		this.logger.debug( "<< getGameData()" );
		return data;
	}

	async getGameStore( gameId: string, authInfo: AuthInfo ) {
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

	async createGame( { playerCount }: CreateGameInput, authInfo: AuthInfo ) {
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

		await this.state.storage.put( data.game.id, data );
		await this.state.storage.put( `code_${ data.game.code }`, data.game.id );

		this.logger.debug( "<< createGame()" );
		return data.game.id;
	}

	async joinGame( input: JoinGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> joinGame()" );

		const gameId = await this.state.storage.get<string>( `code_${ input.code }` );
		if ( !gameId ) {
			this.logger.error( "Game not found!", input.code );
			throw "Game not found!";
		}

		const data = await this.state.storage.get<Literature.GameData>( gameId );
		if ( !data ) {
			this.logger.error( "Game not found!" );
			throw "Game not found!";
		}


		const { isUserAlreadyInGame } = await validateJoinGame( data, authInfo );
		if ( isUserAlreadyInGame ) {
			return data.game.id;
		}

		data.players[ authInfo.id ] = {
			id: authInfo.id,
			name: authInfo.name,
			avatar: authInfo.avatar,
			isBot: false,
			hand: [],
			cardCount: 0,
			metrics: {
				totalAsks: 0,
				cardsTaken: 0,
				cardsGiven: 0,
				totalCalls: 0,
				successfulCalls: 0,
				totalTransfers: 0
			}
		};

		if ( data.game.playerCount === Object.keys( data.players ).length ) {
			data.game.status = "PLAYERS_READY";
		}

		await this.state.storage.put( data.game.id, data );

		this.logger.debug( "<< joinGame()" );
		return data.game.id;
	}

	async addBots( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> addBots()" );

		const data = await this.state.storage.get<Literature.GameData>( input.gameId );
		if ( !data || !data.players[ authInfo.id ] ) {
			this.logger.error( "Game not found!" );
			throw "Game not found!";
		}

		const botCount = await validateAddBots( data );
		for ( let i = 0; i < botCount; i++ ) {
			const bot = {
				id: generateId(),
				name: generateName(),
				avatar: generateAvatar(),
				isBot: true,
				hand: [],
				cardCount: 0,
				cardLocations: [],
				metrics: {
					totalAsks: 0,
					cardsTaken: 0,
					cardsGiven: 0,
					totalCalls: 0,
					successfulCalls: 0,
					totalTransfers: 0
				}
			};
			data.players[ bot.id ] = bot;
		}

		data.game.status = "PLAYERS_READY";
		await this.state.storage.put( data.game.id, data );

		this.logger.debug( "<< addBots()" );
	}

	async createTeams( input: CreateTeamsInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createTeams()" );

		const data = await this.state.storage.get<Literature.GameData>( input.gameId );
		if ( !data || !data.players[ authInfo.id ] ) {
			this.logger.error( "Game not found!" );
			throw "Game not found!";
		}

		await validateCreateTeams( data );

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
		await this.state.storage.put( data.game.id, data );

		this.logger.debug( "<< createTeams()" );
	}

	async startGame( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> startGame()" );

		const data = await this.state.storage.get<Literature.GameData>( input.gameId );
		if ( !data || !data.players[ authInfo.id ] ) {
			this.logger.error( "Game not found!" );
			throw "Game not found!";
		}

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
		await this.state.storage.put( data.game.id, data );

		this.logger.debug( "<< startGame()" );
	}

	async askCard( input: AskCardInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> askCard()" );

		const data = await this.state.storage.get<Literature.GameData>( input.gameId );
		if ( !data || !data.players[ authInfo.id ] ) {
			this.logger.error( "Game not found!" );
			throw "Game not found!";
		}

		const { playerWithAskedCard, askedPlayer } = await validateAskCard( input, data );
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

		await this.state.storage.put( data.game.id, data );

		this.logger.debug( "<< askCard()" );
	}

	async callSet( input: CallSetInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> callSet()" );

		const data = await this.state.storage.get<Literature.GameData>( input.gameId );
		if ( !data || !data.players[ authInfo.id ] ) {
			this.logger.error( "Game not found!" );
			throw "Game not found!";
		}

		const { correctCall, calledSet } = await validateCallSet( input, data );
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

		await this.state.storage.put( data.game.id, data );

		this.logger.debug( "<< callSet()" );
	}

	async transferTurn( input: TransferTurnInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> transferTurn()" );

		const data = await this.state.storage.get<Literature.GameData>( input.gameId );
		if ( !data || !data.players[ authInfo.id ] ) {
			this.logger.error( "Game not found!" );
			throw "Game not found!";
		}

		const { transferringPlayer, receivingPlayer } = await validateTransferTurn( input, data );

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

		await this.state.storage.put( data.game.id, data );

		this.logger.debug( "<< transferTurn()" );
	}

	async executeBotMove( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> executeBotMove()" );

		const data = await this.state.storage.get<Literature.GameData>( input.gameId );
		if ( !data || !data.players[ authInfo.id ] ) {
			this.logger.error( "Game not found!" );
			throw "Game not found!";
		}

		const cardSets = suggestCardSets( data.cardLocations, data.players[ data.game.currentTurn ].hand );

		if ( !!data.lastCall?.success && data.lastCall.playerId === data.game.currentTurn ) {
			this.logger.info( "Last Move was a successful call! Can transfer chance!" );

			const transfers = suggestTransfer( data );
			if ( transfers.length > 0 ) {
				await this.transferTurn( { transferTo: transfers[ 0 ].transferTo, gameId: data.game.id }, authInfo );
				this.logger.debug( "<< executeBotMove()" );
				return;
			}
		}

		const calls = suggestCalls( cardSets, data );
		if ( calls.length > 0 ) {
			await this.callSet( { gameId: data.game.id, data: calls[ 0 ].callData }, authInfo );
			this.logger.debug( "<< executeBotMove()" );
			return;
		}

		const asks = suggestAsks( cardSets, data );
		if ( asks.length === 0 ) {
			this.logger.error( "No Valid Move Found!" );
		}

		const [ bestAsk ] = asks;
		await this.askCard( { from: bestAsk.playerId, card: bestAsk.cardId, gameId: data.game.id }, authInfo );

		this.logger.debug( "<< executeBotMove()" );
	}

	private getPlayerInfo( authInfo: AuthInfo ): Literature.Player {
		return {
			id: authInfo.id,
			name: authInfo.name,
			avatar: authInfo.avatar,
			isBot: false,
			hand: [],
			cardCount: 0,
			metrics: {
				totalAsks: 0,
				cardsTaken: 0,
				cardsGiven: 0,
				totalCalls: 0,
				successfulCalls: 0,
				totalTransfers: 0
			}
		};
	}

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
}