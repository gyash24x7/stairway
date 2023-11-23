import type {
	AskCardInput,
	AskMove,
	CallMove,
	CallSetInput,
	CardsData,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	HandData,
	JoinGameInput,
	Move,
	Player,
	PlayerData,
	PlayerSpecificData,
	ScoreUpdate,
	TeamData,
	TransferMove,
	TransferTurnInput,
	User
} from "@literature/types";
import {
	AskMoveData,
	CallMoveData,
	GameStatus,
	Inference,
	InferenceData,
	MoveType,
	TransferMoveData
} from "@literature/types";
import {
	CardRank,
	CardSet,
	cardSetMap,
	generateGameCode,
	getCardSetsInHand,
	getPlayingCardFromId,
	removeCardsOfRank,
	shuffle,
	SORTED_DECK
} from "@s2h/cards";
import { LoggerFactory, prismaService, PrismaService, RealtimeService } from "@s2h/core";
import { Constants, GameEvents } from "./literature.constants";
import type { LiteratureTransformers } from "./literature.transformers";
import { literatureTransformers } from "./literature.transformers";
import type { LiteratureValidators } from "./literature.validators";
import { literatureValidators } from "./literature.validators";

export class LiteratureService {

	private readonly logger = LoggerFactory.getLogger( LiteratureService );

	constructor(
		private readonly prisma: PrismaService,
		private readonly realtimeService: RealtimeService,
		private readonly validators: LiteratureValidators,
		private readonly transformers: LiteratureTransformers
	) {}

	async createGame( input: CreateGameInput, authUser: User ) {
		this.logger.debug( ">> createGame()" );

		const game = await this.prisma.literature.game.create( {
			data: {
				playerCount: input.playerCount,
				code: generateGameCode(),
				currentTurn: authUser.id
			}
		} );

		const player = await this.prisma.literature.player.create( {
			data: {
				id: authUser.id,
				name: authUser.name,
				avatar: authUser.avatar,
				gameId: game.id
			}
		} );

		this.logger.debug( "<< createGame()" );
		return this.transformers.gameData( { ...game, players: [ player ] } );
	}

	async joinGame( input: JoinGameInput, authUser: User ) {
		this.logger.debug( ">> joinGame()" );

		const { game, isUserAlreadyInGame } = await this.validators.joinGame( { input, authUser } );
		if ( isUserAlreadyInGame ) {
			return game;
		}

		const newPlayer = await this.prisma.literature.player.create( {
			data: {
				id: authUser.id,
				name: authUser.name,
				avatar: authUser.avatar,
				gameId: game.id
			}
		} );

		const isCapacityFull = game.playerCount === game.players.length + 1;
		await this.handlePlayerJoined( game.id, newPlayer, isCapacityFull );

		this.logger.debug( "<< joinGame()" );
		return { ...game, players: [ ...game.players, newPlayer ] };
	}

	async addBots( gameData: GameData ) {
		this.logger.debug( ">> addBots()" );
		const botData: PlayerData = {};

		const botCount = await this.validators.addBots( gameData );

		for ( let i = 0; i < botCount; i++ ) {
			const bot = await this.prisma.literature.player.create( {
				data: {
					gameId: gameData.id,
					name: `Bot ${ i + 1 }`,
					avatar: Constants.AVATAR_BASE_URL + `bot${ i + 1 }`,
					isBot: true
				}
			} );

			botData[ bot.id ] = bot;
			await this.handlePlayerJoined( gameData.id, bot, i === botCount - 1 );
		}

		this.logger.debug( "<< addBots()" );
		return botData;
	}

	async createTeams( input: CreateTeamsInput, gameData: GameData ) {
		this.logger.debug( ">> createTeams()" );

		await this.validators.createTeams( gameData );

		const [ teamA, teamB ] = await Promise.all(
			Object.keys( input.data ).map( teamName => {
				return this.prisma.literature.team.create( {
					data: {
						name: teamName,
						gameId: gameData.id,
						members: {
							connect: input.data[ teamName ].map( ( memberId ) => {
								return { id_gameId: { id: memberId, gameId: gameData.id } };
							} )
						}
					}
				} );
			} )
		);

		const teamData: TeamData = {
			[ teamA.id ]: { ...teamA, members: input.data[ teamA.name ] },
			[ teamB.id ]: { ...teamB, members: input.data[ teamB.name ] }
		};

		await this.handleTeamsCreated( gameData.id, teamData );
		this.logger.debug( "Published TeamsCreatedEvent!" );

		this.logger.debug( "<< createTeams()" );
		return teamData;
	}

	async startGame( gameData: GameData ) {
		this.logger.debug( ">> startGame()" );

		let deck = shuffle( SORTED_DECK );
		deck = removeCardsOfRank( deck, CardRank.SEVEN );
		const playerIds = Object.keys( gameData.players );

		const cardMappings = await Promise.all(
			deck.map( ( card, index ) => {
				return this.prisma.literature.cardMapping.create( {
					data: {
						cardId: card.id,
						gameId: gameData.id,
						playerId: playerIds[ index % gameData.playerCount ]
					}
				} );
			} )
		);

		const cardsData = this.transformers.cardsData( cardMappings );
		await this.handleGameStarted( gameData, cardsData );
		this.logger.debug( "Published GameStartedEvent!" );

		this.logger.debug( "<< startGame()" );
	}

	async askCard( input: AskCardInput, gameData: GameData, playerData: PlayerSpecificData ) {
		this.logger.debug( ">> askCard()" );

		const cardsData = await this.getCardsData( gameData.id );

		const { playerWithAskedCard, askedPlayer } = await this.validators.askCard(
			{ input, gameData, playerData, cardsData }
		);

		const moveSuccess = askedPlayer.id === playerWithAskedCard.id;
		const receivedString = moveSuccess ? "got the card!" : "was declined!";
		const description = `${ playerData.name } asked ${ askedPlayer.name } for ${ input.askedFor } and ${ receivedString }`;
		const askMoveData: AskMoveData = {
			from: input.askedFrom,
			by: playerData.id,
			card: input.askedFor
		};

		const move = await this.prisma.literature.move.create( {
			data: {
				type: MoveType.ASK_CARD,
				gameId: gameData.id,
				success: moveSuccess,
				data: askMoveData,
				description
			}
		} );

		await this.handleMoveCreated( move, gameData, cardsData );

		this.logger.debug( "<< askCard()" );
		return move as AskMove;
	}

	async callSet( input: CallSetInput, gameData: GameData, playerData: PlayerSpecificData ) {
		this.logger.debug( ">> callSet()" );

		const cardsData = await this.getCardsData( gameData.id );

		const { correctCall, calledSet } = await this.validators.callSet(
			{ input, gameData, playerData, cardsData }
		);

		const callingPlayer = gameData.players[ playerData.id ]!;

		let success = true;
		let successString = "correctly!";

		const cardsOfCallingSet = cardSetMap[ calledSet ];
		for ( const card of cardsOfCallingSet ) {
			if ( correctCall[ card.id ] !== input.data[ card.id ] ) {
				success = false;
				successString = "incorrectly!";
				break;
			}
		}

		const callMoveData: CallMoveData = {
			by: playerData.id,
			cardSet: calledSet,
			actualCall: input.data,
			correctCall
		};

		const move = await this.prisma.literature.move.create( {
			data: {
				gameId: gameData.id,
				type: MoveType.CALL_SET,
				success,
				description: `${ callingPlayer.name } called ${ calledSet } ${ successString }`,
				data: callMoveData
			}
		} );

		await this.handleMoveCreated( move, gameData, cardsData );
		this.logger.debug( "Published MoveCreatedEvent!" );

		this.logger.debug( "<< callSet()" );
		return move as CallMove;
	}

	async transferTurn( input: TransferTurnInput, gameData: GameData, playerData: PlayerSpecificData ) {
		this.logger.debug( ">> transferTurn()" );

		const cardsData = await this.getCardsData( gameData.id );

		const { transferringPlayer, receivingPlayer } = await this.validators.transferTurn(
			{ input, cardsData, gameData, playerData }
		);

		const transferMoveData: TransferMoveData = { to: input.transferTo, from: transferringPlayer.id };
		const description = `${ transferringPlayer.name } transferred the turn to ${ receivingPlayer.name }`;

		const move = await this.prisma.literature.move.create( {
			data: {
				gameId: gameData.id,
				type: MoveType.TRANSFER_TURN,
				success: true,
				data: transferMoveData,
				description
			}
		} );

		await this.handleMoveCreated( move, gameData, cardsData );
		this.logger.debug( "Published MoveCreatedEvent!" );

		this.logger.debug( "<< transferTurn()" );
		return move as TransferMove;
	}

	async updateStatus( gameId: string, status: GameStatus ) {
		this.logger.debug( ">> updateStatus()" );

		await this.prisma.literature.game.update( {
			where: { id: gameId },
			data: { status }
		} );

		await this.handleStatusUpdated( gameId, status );

		this.logger.debug( "<< updateStatus()" );
		return status;
	}

	async updateTurn( currentTurn: string, currentMove: Move, players: PlayerData ) {
		this.logger.debug( ">> updateTurn()" );
		let nextTurn: string;

		switch ( currentMove.type ) {
			case MoveType.ASK_CARD: {
				this.logger.debug( "CurrentMove is ASK_MOVE!" );
				const { from, by } = currentMove.data as AskMoveData;
				nextTurn = !currentMove.success ? from : by;
				break;
			}

			case MoveType.CALL_SET: {
				this.logger.debug( "CurrentMoveType is CALL_SET!" );
				const { by } = currentMove.data as CallMoveData;
				const currentTeam = players[ by ].teamId;
				const [ player ] = shuffle( Object.values( players )
					.filter( player => player.teamId !== currentTeam ) );
				nextTurn = !currentMove.success ? player.id : by;
				break;
			}

			default: {
				this.logger.debug( "CurrentMoveType is TRANSFER_TURN!" );
				const data = currentMove.data as TransferMoveData;
				nextTurn = data.to;
				break;
			}
		}

		if ( nextTurn !== currentTurn ) {
			await this.prisma.literature.game.update( {
				where: { id: currentMove.gameId },
				data: { currentTurn: nextTurn }
			} );

			await this.handleTurnUpdated( currentMove.gameId, players, nextTurn );
			this.logger.debug( "Published TurnUpdatedEvent!" );
		}

		this.logger.debug( "<< updateTurn()" );
		return nextTurn;
	}

	async updateHands( currentMove: Move, cardsData: CardsData ) {
		this.logger.debug( ">> updateHands()" );

		let hasCardTransferHappened = false;

		switch ( currentMove.type ) {
			case MoveType.ASK_CARD:
				const { card, by } = currentMove.data as AskMoveData;
				if ( currentMove.success ) {
					await this.prisma.literature.cardMapping.update( {
						where: { cardId_gameId: { gameId: currentMove.gameId, cardId: card } },
						data: { playerId: by }
					} );

					cardsData.mappings[ card ] = by;
					hasCardTransferHappened = true;
				}
				break;

			case MoveType.CALL_SET:
				const { correctCall } = currentMove.data as CallMoveData;
				const calledCards = Object.keys( correctCall );
				await this.prisma.literature.cardMapping.deleteMany( {
					where: { cardId: { in: calledCards } }
				} );

				calledCards.map( cardId => {
					delete cardsData.mappings[ cardId ];
				} );

				hasCardTransferHappened = true;
				break;
		}

		const updatedHands: HandData = {};
		Object.keys( cardsData.mappings ).map( cardId => {
			const playerId = cardsData.mappings[ cardId ];
			if ( !updatedHands[ playerId ] ) {
				updatedHands[ playerId ] = [];
			}
			updatedHands[ playerId ].push( getPlayingCardFromId( cardId ) );
		} );

		cardsData.hands = updatedHands;

		if ( hasCardTransferHappened ) {
			await this.handleHandsUpdated( currentMove.gameId, updatedHands );
		}

		this.logger.debug( "<< updateHands()" );
		return updatedHands;
	}

	async updateScore( currentMove: Move, players: PlayerData, teams: TeamData ) {
		this.logger.debug( ">> updateScore()" );

		if ( currentMove.type !== MoveType.CALL_SET ) {
			this.logger.warn( "Current Move is not Call Set, Not Updating Score!" );
			return;
		}

		const { by, cardSet } = currentMove.data as CallMoveData;
		let winningTeamId = players[ by ].teamId;

		if ( !currentMove.success ) {
			const [ player ] = Object.values( players ).filter( player => player.teamId !== winningTeamId );
			winningTeamId = player.teamId;
		}

		const winningTeam = await this.prisma.literature.team.update( {
			where: { id: winningTeamId! },
			data: {
				score: { increment: 1 },
				setsWon: { push: cardSet }
			}
		} );

		const scoreUpdate: ScoreUpdate = {
			teamId: winningTeam.id,
			score: winningTeam.score,
			setWon: cardSet
		};

		await this.handleScoreUpdated( currentMove.gameId, teams, scoreUpdate );

		this.logger.debug( "<< updateScore()" );
		return scoreUpdate;
	}

	async createInferences( gameData: GameData, hands: HandData ) {
		this.logger.debug( ">> createInferences()" );

		const inferenceData: InferenceData = {};

		await Promise.all(
			Object.keys( gameData.players ).map( playerId => {

				const inference: Omit<Inference, "gameId" | "playerId"> = {
					activeSets: {},
					actualCardLocations: {},
					possibleCardLocations: {},
					inferredCardLocations: {}
				};

				const defaultProbablePlayers = Object.keys( gameData.players ).filter( player => player !== playerId );

				Object.keys( gameData.teams ).forEach( teamId => {
					inference.activeSets[ teamId ] = [];
				} );

				const cards = hands[ playerId ].map( card => card.id );

				SORTED_DECK.forEach( card => {
					if ( cards.includes( card.id ) ) {
						inference.actualCardLocations[ card.id ] = playerId;
						inference.possibleCardLocations[ card.id ] = [ playerId ];
					} else {
						inference.possibleCardLocations[ card.id ] = defaultProbablePlayers;
					}
				} );

				inferenceData[ playerId ] = { ...inference, gameId: gameData.id, playerId };

				return this.prisma.literature.inference.create( {
					data: inferenceData[ playerId ]
				} );
			} )
		);

		await this.handleInferencesUpdated( gameData.id, inferenceData );

		this.logger.debug( "<< createInferences()" );
		return inferenceData;
	}

	async updateInferences( currentMove: Move, players: PlayerData ) {
		this.logger.debug( ">> updateInferences()" );

		let inferences = await this.getInferenceData( currentMove.gameId );

		switch ( currentMove.type ) {
			case MoveType.ASK_CARD:
				inferences = this.updateInferencesOnAskMove( currentMove as AskMove, inferences, players );
				break;

			case MoveType.CALL_SET:
				inferences = this.updateInferencesOnCallMove( currentMove as CallMove, inferences );
				break;
		}

		if ( currentMove.type !== MoveType.TRANSFER_TURN ) {
			await Promise.all( Object.keys( inferences ).map( playerId => {
				return this.prisma.literature.inference.update( {
					where: { gameId_playerId: { playerId, gameId: currentMove.gameId } },
					data: inferences[ playerId ]
				} );
			} ) );

			await this.handleInferencesUpdated( currentMove.gameId, inferences );
		}

		this.logger.debug( "<< updateInferences()" );
		return inferences;
	}

	async executeBotMove( gameId: string, player: Player ) {
		this.logger.debug( ">> executeBotMove()" );

		await this.prisma.literature.inference.findUnique( {
			where: { gameId_playerId: { gameId, playerId: player.id } }
		} );

		this.logger.debug( "<< executeBotMove()" );
	}

	async getCardsData( gameId: string, playerId?: string ) {
		this.logger.debug( ">> getCardsData()" );

		const cardMappings = await this.prisma.literature.cardMapping.findMany( {
			where: { gameId, playerId }
		} );
		const cardsData = this.transformers.cardsData( cardMappings );

		this.logger.debug( "<< getCardsData()" );
		return cardsData;
	}

	async getGameData( gameId: string ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.prisma.literature.game.findUnique( {
			where: { id: gameId },
			include: {
				players: true,
				teams: true,
				cardMappings: true,
				moves: {
					take: 5,
					orderBy: {
						timestamp: "desc"
					}
				}
			}
		} );

		this.logger.debug( "<< getGameData()" );
		return !!data ? this.transformers.gameData( data ) : undefined;
	}

	async getPlayerSpecificData( gameData: GameData, playerId: string ) {
		this.logger.debug( ">> getPlayerSpecificData()" );

		const { hands } = await this.getCardsData( gameData.id, playerId );

		const { teamId, ...info } = gameData.players[ playerId ];
		const cardSets = getCardSetsInHand( hands[ playerId ] ?? [] );

		let oppositeTeamId: string | undefined = undefined;
		if ( !!teamId ) {
			oppositeTeamId = Object.values( gameData.teams ).find( team => team.id !== teamId )?.id;
		}

		const data: PlayerSpecificData = { ...info, hand: hands[ playerId ] ?? [], cardSets, oppositeTeamId, teamId };

		this.logger.debug( "<< getPlayerSpecificData()" );
		return data;
	}

	async getInferenceData( gameId: string ) {
		this.logger.debug( ">> getInferenceData()" );

		const inferences = await this.prisma.literature.inference.findMany( { where: { gameId } } );

		const inferenceData: InferenceData = {};
		inferences.forEach( inference => {
			inferenceData[ inference.playerId ] = {
				...inference,
				activeSets: inference.activeSets as Record<string, CardSet[]>,
				actualCardLocations: inference.actualCardLocations as Record<string, string>,
				possibleCardLocations: inference.possibleCardLocations as Record<string, string[]>,
				inferredCardLocations: inference.inferredCardLocations as Record<string, string>
			};
		} );

		this.logger.debug( "<< getInferenceData()" );
		return inferenceData;
	}

	async handleGameStarted( gameData: GameData, cardsData: CardsData ) {
		this.logger.debug( ">> handleGameStarted()" );

		await this.createInferences( gameData, cardsData.hands );
		await this.updateStatus( gameData.id, GameStatus.IN_PROGRESS );
		await this.handleHandsUpdated( gameData.id, cardsData.hands );

		this.logger.debug( "<< handleGameStarted()" );
	}

	async handleHandsUpdated( gameId: string, hands: HandData ) {
		this.logger.debug( ">> handleHandsUpdated()" );

		const cardCounts: Record<string, number> = {};

		Object.keys( hands ).map( playerId => {
			cardCounts[ playerId ] = hands[ playerId ].length;
			this.realtimeService.publishMemberMessage(
				Constants.LITERATURE,
				gameId,
				playerId,
				GameEvents.HAND_UPDATED,
				hands[ playerId ]
			);
		} );

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.CARD_COUNT_UPDATED,
			cardCounts
		);

		this.logger.debug( "<< handleHandsUpdated()" );
	}

	async handleInferencesUpdated( gameId: string, inferences: InferenceData ) {
		this.logger.debug( ">> handleInferencesUpdated()" );

		Object.keys( inferences ).map( playerId => {
			this.realtimeService.publishMemberMessage(
				Constants.LITERATURE,
				gameId,
				playerId,
				GameEvents.INFERENCES_UPDATED,
				inferences[ playerId ]
			);
		} );

		this.logger.debug( "<< handleInferencesUpdated()" );
	}

	async handleMoveCreated( move: Move, gameData: GameData, cardsData: CardsData ) {
		this.logger.debug( ">> handleMoveCreatedEvent" );

		await this.updateInferences( move, gameData.players );
		await this.updateHands( move, cardsData );
		await this.updateTurn( gameData.currentTurn, move, gameData.players );
		await this.updateScore( move, gameData.players, gameData.teams );

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			move.gameId,
			GameEvents.MOVE_CREATED,
			move
		);

		this.logger.debug( "<< handleMoveCreatedEvent" );
	}

	async handlePlayerJoined( gameId: string, player: Player, isCapacityFull: boolean ) {
		this.logger.debug( ">> handlePlayerJoined()" );

		if ( isCapacityFull ) {
			this.logger.debug( "Player Capacity Full for Game: %s", gameId );
			await this.updateStatus( gameId, GameStatus.PLAYERS_READY );
		}

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.PLAYER_JOINED,
			player
		);

		this.logger.debug( "<< handlePlayerJoined()" );
	}

	async handleScoreUpdated( gameId: string, teams: TeamData, scoreUpdate: ScoreUpdate ) {
		this.logger.debug( ">> handleScoreUpdated()" );

		const setsCompleted: CardSet[] = [ scoreUpdate.setWon ];
		Object.values( teams ).forEach( team => {
			setsCompleted.push( ...team.setsWon as CardSet[] );
		} );

		if ( setsCompleted.length === 8 ) {
			await this.updateStatus( gameId, GameStatus.COMPLETED );
		}

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.SCORE_UPDATED,
			scoreUpdate
		);

		this.logger.debug( "<< handleScoreUpdated()" );
	}

	async handleStatusUpdated( gameId: string, status: GameStatus ) {
		this.logger.debug( ">> handleStatusUpdated()" );

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.STATUS_UPDATED,
			status
		);

		this.logger.debug( "<< handleStatusUpdated()" );
	}

	async handleTeamsCreated( gameId: string, teams: TeamData ) {
		this.logger.debug( ">> handleTeamsCreated()" );

		await this.updateStatus( gameId, GameStatus.TEAMS_CREATED );

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.TEAMS_CREATED,
			teams
		);

		this.logger.debug( "<< handleTeamsCreated()" );
	}

	async handleTurnUpdated( gameId: string, players: PlayerData, nextTurn: string ) {
		this.logger.debug( ">> handleTurnUpdated()" );

		const nextPlayer = players[ nextTurn ];
		if ( nextPlayer.isBot ) {
			// TODO: publish bot move command after 10s
		}

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.TURN_UPDATED,
			nextTurn
		);

		this.logger.debug( "<< handleTurnUpdated()" );
	}

	private updateInferencesOnCallMove( move: CallMove, inferences: InferenceData ) {
		Object.keys( inferences ).map( playerId => {
			const {
				actualCardLocations,
				possibleCardLocations,
				inferredCardLocations,
				activeSets
			} = inferences[ playerId ];

			Object.keys( move.data.correctCall ).map( card => {
				delete actualCardLocations[ card ];
				delete possibleCardLocations[ card ];
				delete inferredCardLocations[ card ];
			} );

			Object.keys( activeSets ).forEach( teamId => {
				const activeSetsSet = new Set( activeSets[ teamId ] );
				activeSetsSet.delete( move.data.cardSet );
				activeSets[ teamId ] = Array.from( activeSetsSet );
			} );

			inferences[ playerId ] = {
				...inferences[ playerId ],
				activeSets,
				actualCardLocations,
				possibleCardLocations,
				inferredCardLocations
			};
		} );

		return inferences;
	}

	private updateInferencesOnAskMove( move: AskMove, inferences: InferenceData, players: PlayerData ) {
		Object.keys( inferences ).map( playerId => {
			const {
				actualCardLocations,
				possibleCardLocations,
				inferredCardLocations,
				activeSets
			} = inferences[ playerId ];

			if ( move.success ) {
				actualCardLocations[ move.data.card ] = move.data.by;
				possibleCardLocations[ move.data.card ] = [ move.data.by ];
			} else {
				possibleCardLocations[ move.data.card ] = possibleCardLocations[ move.data.card ]
					.filter( playerId => playerId !== move.data.from && playerId !== move.data.by );
			}

			const teamId = players[ move.data.by ].teamId!;
			const { set } = getPlayingCardFromId( move.data.card );
			const activeSetsSet = new Set( activeSets[ teamId ] );
			activeSetsSet.add( set );
			activeSets[ teamId ] = Array.from( activeSetsSet );

			inferences[ playerId ] = {
				...inferences[ playerId ],
				activeSets,
				actualCardLocations,
				possibleCardLocations,
				inferredCardLocations
			};
		} );

		return inferences;
	}
}

export const literatureService = new LiteratureService(
	prismaService,
	new RealtimeService(),
	literatureValidators,
	literatureTransformers
);