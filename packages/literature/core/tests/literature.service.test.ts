import { CARD_SETS, CardSet, getCardSetsInHand, getPlayingCardFromId } from "@common/cards";
import type { PrismaService, RealtimeService } from "@common/core";
import {
	CardMapping,
	CreateGameInput,
	CreateTeamsInput,
	Game,
	GameData,
	GameStatus,
	JoinGameInput,
	Move,
	MoveType,
	Player,
	ScoreUpdate,
	TeamData
} from "@literature/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { Constants, GameEvents } from "../src/literature.constants";
import { LiteratureService } from "../src/literature.service";
import type { LiteratureTransformers } from "../src/literature.transformers";
import type { LiteratureValidators } from "../src/literature.validators";
import {
	buildCardsData,
	buildGameData,
	buildMockCardMappings,
	buildMockGameData,
	buildMockInferenceData,
	buildMockRawGameData,
	buildPlayerSpecificData,
	deck,
	mockAskCardInput,
	mockAskMove,
	mockAuthUser,
	mockCallMove,
	mockCallSetInput,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayer4,
	mockPlayerIds,
	mockTeamA,
	mockTeamB,
	mockTransferMove,
	mockTransferTurnInput
} from "./mock-utils.js";

describe( "LiteratureService::askCard", () => {
	const mockInput = mockAskCardInput;

	const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
		if ( card.id === mockInput.askedFor ) {
			return { cardId: card.id, playerId: mockPlayer2.id, gameId: "1" };
		}
		return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
	} );

	const cardsData = buildCardsData( cardMappingList );

	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
	const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should transfer the turn to asked player when asked incorrectly and create ask move", async () => {
		const askMove = { ...mockAskMove, data: { ...mockAskMove.data as any, from: mockPlayer4.id } };
		mockValidators.askCard.mockResolvedValue( { askedPlayer: mockPlayer4, playerWithAskedCard: mockPlayer1 } );
		mockPrisma.literature.move.create.mockResolvedValue( askMove );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const moveCreatedSpy = vi.spyOn( service, "handleMoveCreated" ).mockImplementation( async () => {} );
		const getCardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( cardsData );

		const result = await service.askCard(
			{ ...mockInput, askedFrom: mockPlayer4.id },
			mockGameData,
			mockPlayerSpecificData
		);

		expect( result ).toEqual( askMove );
		expect( mockPrisma.literature.move.create ).toBeCalledTimes( 1 );
		expect( mockPrisma.literature.move.create ).toBeCalledWith( {
			data: {
				type: MoveType.ASK_CARD,
				gameId: mockGameData.id,
				success: false,
				data: {
					from: mockPlayer4.id,
					by: mockAuthUser.id,
					card: mockInput.askedFor
				},
				description: `${ mockPlayer1.name } asked ${ mockPlayer4.name } for ${ mockInput.askedFor } and was declined!`
			}
		} );

		expect( mockValidators.askCard ).toHaveBeenCalledWith( {
			gameData: mockGameData,
			playerData: mockPlayerSpecificData,
			cardsData,
			input: { ...mockInput, askedFrom: mockPlayer4.id }
		} );

		expect( getCardsDataSpy ).toHaveBeenCalledWith( mockGameData.id );
		expect( moveCreatedSpy ).toHaveBeenCalledWith( askMove, mockGameData, cardsData );
	} );

	it( "should transfer the card to the asking player when asked correctly and create ask move", async () => {
		mockValidators.askCard.mockResolvedValue( { askedPlayer: mockPlayer2, playerWithAskedCard: mockPlayer2 } );
		mockPrisma.literature.move.create.mockResolvedValue( mockAskMove );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const moveCreatedSpy = vi.spyOn( service, "handleMoveCreated" ).mockImplementation( async () => {} );
		const getCardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( cardsData );

		const result = await service.askCard( mockInput, mockGameData, mockPlayerSpecificData );

		expect( result ).toEqual( mockAskMove );
		expect( mockPrisma.literature.move.create ).toBeCalledTimes( 1 );
		expect( mockPrisma.literature.move.create ).toBeCalledWith( {
			data: {
				type: MoveType.ASK_CARD,
				gameId: mockGameData.id,
				success: true,
				data: {
					from: mockInput.askedFrom,
					by: mockAuthUser.id,
					card: mockInput.askedFor
				},
				description: `${ mockPlayer1.name } asked ${ mockPlayer2.name } for ${ mockInput.askedFor } and got the card!`
			}
		} );

		expect( mockValidators.askCard ).toHaveBeenCalledWith( {
			input: mockInput,
			gameData: mockGameData,
			cardsData,
			playerData: mockPlayerSpecificData
		} );

		expect( getCardsDataSpy ).toHaveBeenCalledWith( mockGameData.id );
		expect( moveCreatedSpy ).toHaveBeenCalledWith( mockAskMove, mockGameData, cardsData );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );

} );

describe( "LiteratureService::callSet", () => {

	const mockInput = mockCallSetInput;

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should increase opposite team score and remove cards of set on unsuccessful call", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];

			if ( card.id === "SixOfClubs" ) {
				return { cardId: card.id, playerId: mockPlayer4.id, gameId: "1" };
			}

			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const mockMove: Move = {
			...mockCallMove,
			success: false,
			data: { ...mockCallMove.data as any, correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id } },
			description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } incorrectly!`
		};

		mockPrisma.literature.move.create.mockResolvedValue( mockMove );
		mockValidators.callSet.mockResolvedValue( {
			correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id },
			calledSet: CardSet.LOWER_CLUBS
		} );

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const moveCreatedSpy = vi.spyOn( service, "handleMoveCreated" ).mockImplementation( async () => {} );
		const getCardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( cardsData );

		const result = await service.callSet( mockInput, mockGameData, mockPlayerSpecificData );

		expect( result ).toEqual( mockMove );
		expect( mockPrisma.literature.move.create ).toHaveBeenCalledWith( {
			data: {
				gameId: mockGameData.id,
				type: MoveType.CALL_SET,
				success: false,
				description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } incorrectly!`,
				data: {
					by: mockPlayer1.id,
					cardSet: CardSet.LOWER_CLUBS,
					actualCall: mockInput.data,
					correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id }
				}
			}
		} );

		expect( mockValidators.callSet ).toHaveBeenCalledWith( {
			input: mockInput,
			gameData: mockGameData,
			playerData: mockPlayerSpecificData,
			cardsData
		} );

		expect( getCardsDataSpy ).toHaveBeenCalledWith( mockGameData.id );
		expect( moveCreatedSpy ).toHaveBeenCalledWith( mockMove, mockGameData, cardsData );
	} );

	it( "should increase current team score and remove cards of set on successful call", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		mockPrisma.literature.move.create.mockResolvedValue( mockCallMove );
		mockValidators.callSet.mockResolvedValue( {
			correctCall: mockInput.data,
			calledSet: CardSet.LOWER_CLUBS
		} );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const moveCreatedSpy = vi.spyOn( service, "handleMoveCreated" ).mockImplementation( async () => {} );
		const getCardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( cardsData );

		const result = await service.callSet( mockInput, mockGameData, mockPlayerSpecificData );

		expect( result ).toEqual( mockCallMove );
		expect( mockPrisma.literature.move.create ).toHaveBeenCalledWith( {
			data: {
				gameId: mockGameData.id,
				type: MoveType.CALL_SET,
				success: true,
				description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } correctly!`,
				data: {
					by: mockPlayer1.id,
					cardSet: CardSet.LOWER_CLUBS,
					actualCall: mockInput.data,
					correctCall: mockInput.data
				}
			}
		} );

		expect( mockValidators.callSet ).toHaveBeenCalledWith( {
			input: mockInput,
			gameData: mockGameData,
			playerData: mockPlayerSpecificData,
			cardsData
		} );
		expect( getCardsDataSpy ).toHaveBeenCalledWith( mockGameData.id );
		expect( moveCreatedSpy ).toHaveBeenCalledWith( mockCallMove, mockGameData, cardsData );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::createGame", () => {

	const mockInput: CreateGameInput = {
		playerCount: 4
	};

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const mockGame = mockDeep<Game>();
	const mockNewPlayer = mockDeep<Player>();
	const mockGameData = mockDeep<GameData>();
	mockGame.id = "game123";
	mockGameData.id = "game123";

	it( "should create a new game and add the logged in player", async () => {
		mockPrisma.literature.game.create.mockResolvedValue( mockGame );
		mockPrisma.literature.player.create.mockResolvedValue( mockNewPlayer );
		mockTransformers.gameData.mockReturnValue( mockGameData );

		const service = new LiteratureService(
			mockPrisma,
			mockRealtimeService,
			mockValidators,
			mockTransformers
		);

		const result = await service.createGame( mockInput, mockAuthUser );

		expect( result.id ).toEqual( mockGame.id );

		expect( mockPrisma.literature.game.create ).toHaveBeenCalledWith( {
			data: expect.objectContaining( {
				playerCount: 4,
				currentTurn: mockPlayer1.id
			} )
		} );

		expect( mockPrisma.literature.player.create ).toHaveBeenCalledWith( {
			data: expect.objectContaining( {
				id: mockPlayer1.id,
				gameId: "game123"
			} )
		} );

		expect( mockTransformers.gameData ).toHaveBeenCalledWith( { ...mockGame, players: [ mockNewPlayer ] } );
	} );


	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::createInferences", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappingList = buildMockCardMappings();
	const { hands } = buildCardsData( cardMappingList );
	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED, cardMappingList );
	const inferenceData = buildMockInferenceData( mockGameData.id, cardMappingList );

	it( "should create inferences for each player and publish InferenceUpdatedEvent", async () => {
		const mock = mockPrisma.literature.inference.create;
		Object.keys( hands ).forEach( playerId => {
			mock.mockResolvedValueOnce( inferenceData[ playerId ] );
		} );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const inferencesUpdatedSpy = vi.spyOn( service, "handleInferencesUpdated" )
			.mockImplementation( async () => {} );

		const result = await service.createInferences( mockGameData, hands );

		expect( result ).toEqual( inferenceData );

		expect( mock ).toHaveBeenCalledTimes( 4 );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "1" ] } );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "2" ] } );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "3" ] } );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "4" ] } );

		expect( inferencesUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( inferencesUpdatedSpy ).toHaveBeenCalledWith( mockGameData.id, inferenceData );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::createTeams", () => {
	const mockInput: CreateTeamsInput = {
		data: {
			[ mockTeamA.name ]: [ mockPlayer1.id, mockPlayer3.id ],
			[ mockTeamB.name ]: [ mockPlayer2.id, mockPlayer4.id ]
		}
	};

	const mockGameData = buildMockGameData( GameStatus.PLAYERS_READY );

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should create teams and assign teams to players", async () => {
		mockPrisma.literature.team.create.mockResolvedValueOnce( mockTeamA ).mockResolvedValueOnce( mockTeamB );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const teamsCreatedSpy = vi.spyOn( service, "handleTeamsCreated" ).mockImplementation( async () => {} );

		const result = await service.createTeams( mockInput, mockGameData );

		expect( result ).toEqual( {
			[ mockTeamA.id ]: { ...mockTeamA, members: mockInput.data[ mockTeamA.name ] },
			[ mockTeamB.id ]: { ...mockTeamB, members: mockInput.data[ mockTeamB.name ] }
		} );

		expect( mockPrisma.literature.team.create ).toHaveBeenCalledTimes( 2 );
		expect( mockPrisma.literature.team.create ).toHaveBeenCalledWith( {
			data: {
				name: "Team A",
				gameId: "1",
				members: {
					connect: [
						{ id_gameId: { id: "1", gameId: "1" } },
						{ id_gameId: { id: "3", gameId: "1" } }
					]
				}
			}
		} );

		expect( mockPrisma.literature.team.create ).toHaveBeenCalledWith( {
			data: {
				name: "Team B",
				gameId: "1",
				members: {
					connect: [
						{ id_gameId: { id: "2", gameId: "1" } },
						{ id_gameId: { id: "4", gameId: "1" } }
					]
				}
			}
		} );

		expect( teamsCreatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( teamsCreatedSpy ).toHaveBeenCalledWith( mockGameData.id, result );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::joinGame", () => {
	const mockInput: JoinGameInput = { code: "BCDEDIT" };
	const mockGame = buildMockRawGameData( GameStatus.CREATED );

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should return game if user already part of game", async () => {
		mockValidators.joinGame.mockResolvedValue( { game: mockGame, isUserAlreadyInGame: true } );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const playerJoinedSpy = vi.spyOn( service, "handlePlayerJoined" ).mockImplementation( async () => {} );

		const gameWithPlayers = await service.joinGame( mockInput, mockAuthUser );

		expect( gameWithPlayers.players ).toEqual( [
			{ ...mockPlayer1, teamId: null },
			{ ...mockPlayer2, teamId: null },
			{ ...mockPlayer3, teamId: null },
			{ ...mockPlayer4, teamId: null }
		] );
		expect( playerJoinedSpy ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should add user to the game and publish game update event", async () => {
		mockValidators.joinGame.mockResolvedValue( {
			game: {
				...mockGame,
				playerCount: 6,
				players: [ mockPlayer2, mockPlayer4, mockPlayer3 ]
			},
			isUserAlreadyInGame: false
		} );
		mockPrisma.literature.player.create.mockResolvedValue( mockPlayer1 );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const playerJoinedSpy = vi.spyOn( service, "handlePlayerJoined" ).mockImplementation( async () => {} );

		const gameWithPlayers = await service.joinGame( mockInput, mockAuthUser );

		expect( mockPrisma.literature.player.create ).toHaveBeenCalledWith( {
			data: {
				id: mockAuthUser.id,
				name: mockAuthUser.name,
				avatar: mockAuthUser.avatar,
				gameId: mockGame.id
			}
		} );
		expect( mockValidators.joinGame ).toHaveBeenCalledWith( { input: mockInput, authUser: mockAuthUser } );
		expect( gameWithPlayers.players ).toEqual( [ mockPlayer2, mockPlayer4, mockPlayer3, mockPlayer1 ] );
		expect( playerJoinedSpy ).toHaveBeenCalledTimes( 1 );
		expect( playerJoinedSpy ).toHaveBeenCalledWith( mockGame.id, mockPlayer1, false );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::startGame", () => {
	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED );

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should create card mappings and start the game", async () => {
		const mock = mockPrisma.literature.cardMapping.create;
		const cardMappingList: CardMapping[] = [];
		deck.forEach( ( card, index ) => {
			const cardMapping = {
				cardId: card.id,
				gameId: mockGameData.id,
				playerId: mockPlayerIds[ index % mockGameData.playerCount ]
			};
			mock.mockResolvedValueOnce( cardMapping );
			cardMappingList.push( cardMapping );
		} );

		const cardsData = buildCardsData( cardMappingList );
		mockTransformers.cardsData.mockReturnValue( cardsData );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const gameStartedSpy = vi.spyOn( service, "handleGameStarted" ).mockImplementation( async () => {} );
		await service.startGame( mockGameData );

		expect( mock ).toHaveBeenCalledTimes( deck.length );
		expect( mockTransformers.cardsData ).toHaveBeenCalledWith( cardMappingList );
		expect( gameStartedSpy ).toHaveBeenCalledTimes( 1 );
		expect( gameStartedSpy ).toHaveBeenCalledWith( mockGameData, cardsData );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::transferTurn", () => {

	const mockInput = mockTransferTurnInput;
	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should transfer turn to another player", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList, [ mockCallMove ] );

		mockPrisma.literature.move.create.mockResolvedValue( mockTransferMove );
		mockValidators.transferTurn.mockResolvedValue( {
			transferringPlayer: mockPlayer1,
			receivingPlayer: mockPlayer3
		} );

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const moveCreatedSpy = vi.spyOn( service, "handleMoveCreated" ).mockImplementation( async () => {} );
		const getCardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( cardsData );

		const result = await service.transferTurn( mockInput, mockGameData, mockPlayerSpecificData );

		expect( result ).toEqual( mockTransferMove );
		expect( mockPrisma.literature.move.create ).toHaveBeenCalledTimes( 1 );
		expect( mockPrisma.literature.move.create ).toHaveBeenCalledWith( {
			data: {
				gameId: mockGameData.id,
				type: MoveType.TRANSFER_TURN,
				success: true,
				data: {
					to: mockInput.transferTo,
					from: mockAuthUser.id
				},
				description: `${ mockPlayer1.name } transferred the turn to ${ mockPlayer3.name }`
			}
		} );
		expect( mockValidators.transferTurn ).toHaveBeenCalledWith( {
			input: mockInput,
			gameData: mockGameData,
			playerData: mockPlayerSpecificData,
			cardsData
		} );
		expect( getCardsDataSpy ).toHaveBeenCalledWith( mockGameData.id );
		expect( moveCreatedSpy ).toHaveBeenCalledWith( mockTransferMove, mockGameData, cardsData );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::updateHands", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappingList = buildMockCardMappings();
	const cardsData = buildCardsData( cardMappingList );

	it( "should transfer the card to the player who asked for it on successful ask", async () => {
		cardsData.mappings[ mockAskMove.data.card ] = mockAskMove.data.from;
		const card = getPlayingCardFromId( mockAskMove.data.card );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const handsUpdatedSpy = vi.spyOn( service, "handleHandsUpdated" ).mockImplementation( async () => {} );

		const updatedHands = await service.updateHands( mockAskMove, cardsData );

		expect( updatedHands[ mockAskMove.data.by ] ).toContainEqual( card );
		expect( updatedHands[ mockAskMove.data.from ] ).not.toContainEqual( card );

		expect( mockPrisma.literature.cardMapping.update ).toHaveBeenCalledWith( {
			where: { cardId_gameId: { gameId: mockAskMove.gameId, cardId: mockAskMove.data.card } },
			data: { playerId: mockAskMove.data.by }
		} );
		expect( handsUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( handsUpdatedSpy ).toHaveBeenCalledWith( mockAskMove.gameId, updatedHands );
	} );

	it( "should do nothing on unsuccessful ask", async () => {
		cardsData.mappings[ mockAskMove.data.card ] = mockAskMove.data.from;
		const card = getPlayingCardFromId( mockAskMove.data.card );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const handsUpdatedSpy = vi.spyOn( service, "handleHandsUpdated" ).mockImplementation( async () => {} );

		const updatedHands = await service.updateHands( { ...mockAskMove, success: false }, cardsData );

		expect( updatedHands[ mockAskMove.data.by ] ).not.toContainEqual( card );
		expect( updatedHands[ mockAskMove.data.from ] ).toContainEqual( card );

		expect( mockPrisma.literature.cardMapping.update ).toHaveBeenCalledTimes( 0 );
		expect( handsUpdatedSpy ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should remove the cards of that set on successful call", async () => {
		const calledSet = mockCallMove.data.cardSet;
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const handsUpdatedSpy = vi.spyOn( service, "handleHandsUpdated" ).mockImplementation( async () => {} );

		const updatedHands = await service.updateHands( mockCallMove, cardsData );

		const allCardsOfCalledSet = Object.values( updatedHands ).flat().filter( card => card.set === calledSet );
		const calledCards = Object.keys( mockCallMove.data.correctCall );

		expect( allCardsOfCalledSet ).toHaveLength( 0 );
		expect( mockPrisma.literature.cardMapping.deleteMany ).toHaveBeenCalledWith( {
			where: { cardId: { in: calledCards } }
		} );
		expect( handsUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( handsUpdatedSpy ).toHaveBeenCalledWith( mockCallMove.gameId, updatedHands );

	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::updateInferences", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const mockCardMappingList = buildMockCardMappings();
	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, mockCardMappingList );
	const mockInferenceData = buildMockInferenceData( mockGameData.id, mockCardMappingList );

	it( "should updated inferences for all players on successful ask", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const inferenceDataSpy = vi.spyOn( service, "getInferenceData" ).mockResolvedValue( mockInferenceData );
		const inferencesUpdatedSpy = vi.spyOn( service, "handleInferencesUpdated" )
			.mockImplementation( async () => {} );

		const updatedInferences = await service.updateInferences( mockAskMove, mockGameData.players );

		expect( inferenceDataSpy ).toHaveBeenCalledWith( mockGameData.id );
		expect( mockPrisma.literature.inference.update ).toHaveBeenCalledTimes( mockGameData.playerCount );
		Object.keys( mockGameData.players ).map( playerId => {
			const { actualCardLocations } = updatedInferences[ playerId ];
			expect( actualCardLocations[ mockAskMove.data.card ] ).toEqual( mockAskMove.data.by );
			expect( mockPrisma.literature.inference.update ).toHaveBeenCalledWith( {
				where: { gameId_playerId: { playerId, gameId: mockAskMove.gameId } },
				data: updatedInferences[ playerId ]
			} );
		} );
		expect( inferencesUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( inferencesUpdatedSpy ).toHaveBeenCalledWith( mockAskMove.gameId, updatedInferences );
	} );

	it( "should update inferences for all players on unsuccessful ask", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const inferenceDataSpy = vi.spyOn( service, "getInferenceData" ).mockResolvedValue( mockInferenceData );
		const inferencesUpdatedSpy = vi.spyOn( service, "handleInferencesUpdated" )
			.mockImplementation( async () => {} );

		const updatedInferences = await service.updateInferences(
			{ ...mockAskMove, success: false },
			mockGameData.players
		);

		expect( inferenceDataSpy ).toHaveBeenCalledWith( mockGameData.id );
		expect( mockPrisma.literature.inference.update ).toHaveBeenCalledTimes( mockGameData.playerCount );
		Object.keys( mockGameData.players ).map( playerId => {
			const { possibleCardLocations } = updatedInferences[ playerId ];
			if ( !!possibleCardLocations[ mockAskMove.data.card ] ) {
				expect( possibleCardLocations[ mockAskMove.data.card ] ).not.toContainEqual( mockAskMove.data.by );
				expect( possibleCardLocations[ mockAskMove.data.card ] ).not.toContainEqual( mockAskMove.data.from );
			}
			expect( mockPrisma.literature.inference.update ).toHaveBeenCalledWith( {
				where: { gameId_playerId: { playerId, gameId: mockAskMove.gameId } },
				data: updatedInferences[ playerId ]
			} );
		} );
		expect( inferencesUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( inferencesUpdatedSpy ).toHaveBeenCalledWith( mockAskMove.gameId, updatedInferences );
	} );

	it( "should remove inferences for the called set for all players on call", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const inferenceDataSpy = vi.spyOn( service, "getInferenceData" ).mockResolvedValue( mockInferenceData );
		const inferencesUpdatedSpy = vi.spyOn( service, "handleInferencesUpdated" )
			.mockImplementation( async () => {} );

		const updatedInferences = await service.updateInferences( mockCallMove, mockGameData.players );

		const cardsOfCalledSetInInference = Object.values( updatedInferences )
			.flatMap( inference => [
				...Object.keys( inference.possibleCardLocations ),
				...Object.keys( inference.actualCardLocations ),
				...Object.keys( inference.inferredCardLocations )
			] )
			.map( getPlayingCardFromId )
			.filter( card => card.set === mockCallMove.data.cardSet );

		expect( inferenceDataSpy ).toHaveBeenCalledWith( mockGameData.id );
		expect( cardsOfCalledSetInInference ).toHaveLength( 0 );
		expect( mockPrisma.literature.inference.update ).toHaveBeenCalledTimes( mockGameData.playerCount );

		Object.keys( mockGameData.players ).map( playerId => {
			expect( mockPrisma.literature.inference.update ).toHaveBeenCalledWith( {
				where: { gameId_playerId: { playerId, gameId: mockAskMove.gameId } },
				data: updatedInferences[ playerId ]
			} );
		} );
		expect( inferencesUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( inferencesUpdatedSpy ).toHaveBeenCalledWith( mockAskMove.gameId, updatedInferences );
	} );

	it( "should do nothing if the move is a transfer move", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const inferenceDataSpy = vi.spyOn( service, "getInferenceData" ).mockResolvedValue( mockInferenceData );
		const inferencesUpdatedSpy = vi.spyOn( service, "handleInferencesUpdated" )
			.mockImplementation( async () => {} );

		const updatedInferences = await service.updateInferences( mockTransferMove, mockGameData.players );

		expect( inferenceDataSpy ).toHaveBeenCalledTimes( 1 );
		expect( updatedInferences ).toEqual( mockInferenceData );
		expect( mockPrisma.literature.player.update ).toHaveBeenCalledTimes( 0 );
		expect( inferencesUpdatedSpy ).toHaveBeenCalledTimes( 0 );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::updateStatus", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should update game status and publish StatusUpdatedEvent", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const statusUpdatedSpy = vi.spyOn( service, "handleStatusUpdated" ).mockImplementation( async () => {} );

		await service.updateStatus( "1", GameStatus.TEAMS_CREATED );

		expect( mockPrisma.literature.game.update ).toHaveBeenCalledTimes( 1 );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: "1" },
			data: { status: GameStatus.TEAMS_CREATED }
		} );
		expect( statusUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( statusUpdatedSpy ).toHaveBeenCalledWith( "1", GameStatus.TEAMS_CREATED );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::updateScore", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS );

	it( "should not update score if currentMove is not valid", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const scoreUpdatedSpy = vi.spyOn( service, "handleScoreUpdated" ).mockImplementation( async () => {} );

		const scoreUpdate = await service.updateScore( mockAskMove, mockGameData.players, mockGameData.teams );
		expect( scoreUpdate ).toBeUndefined();
		expect( mockPrisma.literature.team.update ).toHaveBeenCalledTimes( 0 );
		expect( scoreUpdatedSpy ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should update score of opposing team if currentMove is not successful", async () => {
		mockPrisma.literature.team.update.mockResolvedValue( { ...mockTeamB, score: 1 } );
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const scoreUpdatedSpy = vi.spyOn( service, "handleScoreUpdated" ).mockImplementation( async () => {} );

		const scoreUpdate = await service.updateScore(
			{ ...mockCallMove, success: false },
			mockGameData.players,
			mockGameData.teams
		);

		expect( scoreUpdate?.teamId ).toEqual( mockTeamB.id );
		expect( scoreUpdate?.score ).toEqual( 1 );
		expect( scoreUpdate?.setWon ).toEqual( CardSet.LOWER_CLUBS );

		expect( mockPrisma.literature.team.update ).toHaveBeenCalledWith( {
			where: { id: mockTeamB.id },
			data: {
				score: { increment: 1 },
				setsWon: { push: CardSet.LOWER_CLUBS }
			}
		} );
		expect( scoreUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( scoreUpdatedSpy ).toHaveBeenCalledWith( mockGameData.id, mockGameData.teams, scoreUpdate! );
	} );

	it( "should update score of the team if currentMove is successful", async () => {
		mockPrisma.literature.team.update.mockResolvedValue( { ...mockTeamA, score: 4 } );
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const scoreUpdatedSpy = vi.spyOn( service, "handleScoreUpdated" ).mockImplementation( async () => {} );

		const scoreUpdate = await service.updateScore( mockCallMove, mockGameData.players, mockGameData.teams );

		expect( scoreUpdate?.teamId ).toEqual( mockTeamA.id );
		expect( scoreUpdate?.score ).toEqual( 4 );
		expect( scoreUpdate?.setWon ).toEqual( CardSet.LOWER_CLUBS );

		expect( mockPrisma.literature.team.update ).toHaveBeenCalledWith( {
			where: { id: mockTeamA.id },
			data: {
				score: { increment: 1 },
				setsWon: { push: CardSet.LOWER_CLUBS }
			}
		} );
		expect( scoreUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( scoreUpdatedSpy ).toHaveBeenCalledWith( mockGameData.id, mockGameData.teams, scoreUpdate! );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::updateTurn", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS );

	it( "should do nothing on a successful ask", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const turnUpdatedSpy = vi.spyOn( service, "handleTurnUpdated" ).mockImplementation( async () => {} );

		const updatedTurn = await service.updateTurn( mockGameData.currentTurn, mockAskMove, mockGameData.players );

		expect( updatedTurn ).toEqual( mockAskMove.data.by );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledTimes( 0 );
		expect( turnUpdatedSpy ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should update turn to asked player on unsuccessful ask", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const turnUpdatedSpy = vi.spyOn( service, "handleTurnUpdated" ).mockImplementation( async () => {} );

		const updatedTurn = await service.updateTurn(
			mockGameData.currentTurn,
			{ ...mockAskMove, success: false },
			mockGameData.players
		);

		expect( updatedTurn ).toEqual( mockAskMove.data.from );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockAskMove.gameId },
			data: { currentTurn: updatedTurn }
		} );
		expect( turnUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( turnUpdatedSpy ).toHaveBeenCalledWith( mockAskMove.gameId, mockGameData.players, updatedTurn );
	} );

	it( "should do nothing on successful call", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const turnUpdatedSpy = vi.spyOn( service, "handleTurnUpdated" ).mockImplementation( async () => {} );
		const updatedTurn = await service.updateTurn( mockGameData.currentTurn, mockCallMove, mockGameData.players );

		expect( updatedTurn ).toEqual( mockCallMove.data.by );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledTimes( 0 );
		expect( turnUpdatedSpy ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should update turn to random player of opposite team on unsuccessful call", async () => {
		const callingPlayer = mockGameData.players[ mockCallMove.data.by ];
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const turnUpdatedSpy = vi.spyOn( service, "handleTurnUpdated" ).mockImplementation( async () => {} );
		const updatedTurn = await service.updateTurn(
			mockGameData.currentTurn,
			{ ...mockCallMove, success: false },
			mockGameData.players
		);

		const receivedPlayer = mockGameData.players[ updatedTurn ];
		expect( receivedPlayer.teamId ).not.toEqual( callingPlayer.teamId );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockCallMove.gameId },
			data: { currentTurn: updatedTurn }
		} );
		expect( turnUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( turnUpdatedSpy ).toHaveBeenCalledWith( mockCallMove.gameId, mockGameData.players, updatedTurn );
	} );

	it( "should update turn to mentioned player on transfer turn", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const turnUpdatedSpy = vi.spyOn( service, "handleTurnUpdated" ).mockImplementation( async () => {} );

		const updatedTurn = await service.updateTurn(
			mockGameData.currentTurn,
			mockTransferMove,
			mockGameData.players
		);

		expect( updatedTurn ).toEqual( mockTransferMove.data.to );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockAskMove.gameId },
			data: { currentTurn: updatedTurn }
		} );
		expect( turnUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( turnUpdatedSpy ).toHaveBeenCalledWith( mockAskMove.gameId, mockGameData.players, updatedTurn );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );


describe( "LiteratureService::getCardsData", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappings = buildMockCardMappings();

	it( "should fetch card player mappings", async () => {
		mockPrisma.literature.cardMapping.findMany.mockResolvedValue( cardMappings );
		mockTransformers.cardsData.mockReturnValue( buildCardsData( cardMappings ) );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const result = await service.getCardsData( "1" );

		const randomIndex = Math.floor( Math.random() * deck.length );
		const randomCardMapping = cardMappings[ randomIndex ];

		expect( Object.keys( result.mappings ).length ).toEqual( deck.length );
		expect( Object.keys( result.hands ).length ).toEqual( 4 );
		expect( result.mappings[ randomCardMapping.cardId ] ).toEqual( randomCardMapping.playerId );
		expect( mockTransformers.cardsData ).toHaveBeenCalledWith( cardMappings );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::getGameData", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappings = buildMockCardMappings();
	const mockMoves = [ mockTransferMove, mockCallMove, mockAskMove ];

	it( "should fetch aggregated game data", async () => {
		const rawGameData = buildMockRawGameData( GameStatus.IN_PROGRESS, cardMappings, mockMoves );
		mockPrisma.literature.game.findUnique.mockResolvedValue( rawGameData as any );
		mockTransformers.gameData.mockReturnValue( buildGameData( rawGameData ) );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const result = await service.getGameData( "1" );

		expect( result?.id ).toEqual( "1" );
		expect( result?.status ).toEqual( "IN_PROGRESS" );
		expect( result?.teams ).toEqual( {
			[ mockTeamA.id ]: { ...mockTeamA, members: [ mockPlayer1.id, mockPlayer3.id ] },
			[ mockTeamB.id ]: { ...mockTeamB, members: [ mockPlayer2.id, mockPlayer4.id ] }
		} );
		expect( result?.players ).toEqual( {
			[ mockPlayer1.id ]: mockPlayer1,
			[ mockPlayer2.id ]: mockPlayer2,
			[ mockPlayer3.id ]: mockPlayer3,
			[ mockPlayer4.id ]: mockPlayer4
		} );
		expect( result?.moves ).toEqual( mockMoves );
		expect( mockTransformers.gameData ).toHaveBeenCalledWith( rawGameData );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::getPlayerSpecificData", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappings = buildMockCardMappings();
	const { hands } = buildCardsData( cardMappings );

	it( "should return the current game data for the player when teams not created", async () => {
		const mockGameData = buildMockGameData( GameStatus.PLAYERS_READY );

		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const cardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( buildCardsData( [] ) );

		const result = await service.getPlayerSpecificData( mockGameData, mockAuthUser.id );

		expect( result ).toEqual(
			expect.objectContaining( {
				id: "1",
				oppositeTeamId: undefined,
				hand: [],
				cardSets: []
			} )
		);
		expect( cardsDataSpy ).toHaveBeenCalledTimes( 1 );
		expect( cardsDataSpy ).toHaveBeenCalledWith( mockGameData.id, mockAuthUser.id );
	} );

	it( "should return the current game data for the player when teams created", async () => {
		const cardMappingsForPlayer = cardMappings.filter( cardMapping => cardMapping.playerId === mockAuthUser.id );
		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappings );
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const cardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue(
			buildCardsData( cardMappingsForPlayer )
		);

		const result = await service.getPlayerSpecificData( mockGameData, mockAuthUser.id );

		expect( result.teamId ).toEqual( mockTeamA.id );
		expect( result.oppositeTeamId ).toEqual( mockTeamB.id );
		expect( result.hand ).toEqual( hands[ mockAuthUser.id ] );
		expect( result.cardSets ).toEqual( getCardSetsInHand( hands[ mockAuthUser.id ] ) );
		expect( cardsDataSpy ).toHaveBeenCalledTimes( 1 );
		expect( cardsDataSpy ).toHaveBeenCalledWith( mockGameData.id, mockAuthUser.id );
	} );


	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleGameStarted", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardsData = buildCardsData( buildMockCardMappings() );
	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED );


	it( "should create inferences, update status and publish hand updated message to the players", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const createInferencesSpy = vi.spyOn( service, "createInferences" ).mockResolvedValue( mockDeep() );
		const updateStatusSpy = vi.spyOn( service, "updateStatus" ).mockResolvedValue( mockDeep() );
		const handsUpdatedSpy = vi.spyOn( service, "handleHandsUpdated" ).mockImplementation( async () => {} );

		await service.handleGameStarted( mockGameData, cardsData );

		expect( createInferencesSpy ).toHaveBeenCalledWith( mockGameData, cardsData.hands );
		expect( updateStatusSpy ).toHaveBeenCalledWith( mockGameData.id, GameStatus.IN_PROGRESS );
		expect( handsUpdatedSpy ).toHaveBeenCalledWith( mockGameData.id, cardsData.hands );
	} );


	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleHandsUpdated", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const { hands } = buildCardsData( buildMockCardMappings() );
	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED );

	it( "should publish hand updated message to the players", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );

		await service.handleHandsUpdated( mockGameData.id, hands );

		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledTimes( 4 );
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"1",
			GameEvents.HAND_UPDATED,
			hands[ "1" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"2",
			GameEvents.HAND_UPDATED,
			hands[ "2" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"3",
			GameEvents.HAND_UPDATED,
			hands[ "3" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"4",
			GameEvents.HAND_UPDATED,
			hands[ "4" ]
		);
		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.CARD_COUNT_UPDATED,
			{ "1": 12, "2": 12, "3": 12, "4": 12 }
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleInferencesUpdated", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappingList = buildMockCardMappings();
	const inferenceData = buildMockInferenceData( "1", cardMappingList );

	it( "should publish inferences updated message to the players", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );

		await service.handleInferencesUpdated( "1", inferenceData );


		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledTimes( 4 );
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"1",
			GameEvents.INFERENCES_UPDATED,
			inferenceData[ "1" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"2",
			GameEvents.INFERENCES_UPDATED,
			inferenceData[ "2" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"3",
			GameEvents.INFERENCES_UPDATED,
			inferenceData[ "3" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"4",
			GameEvents.INFERENCES_UPDATED,
			inferenceData[ "4" ]
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleMoveCreated", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappingList = buildMockCardMappings();
	const cardsData = buildCardsData( cardMappingList );
	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList, [ mockCallMove ] );


	it( "should update hands, inferences, score and turn when move created", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const handsUpdatedSpy = vi.spyOn( service, "updateHands" ).mockResolvedValue( cardsData.hands );
		const inferencesUpdatedSpy = vi.spyOn( service, "updateInferences" ).mockResolvedValue( mockDeep() );
		const scoreUpdatedSpy = vi.spyOn( service, "updateScore" ).mockResolvedValue( mockDeep() );
		const turnUpdatedSpy = vi.spyOn( service, "updateTurn" ).mockResolvedValue( mockDeep() );

		await service.handleMoveCreated( mockAskMove, mockGameData, cardsData );

		expect( inferencesUpdatedSpy ).toHaveBeenCalledWith( mockAskMove, mockGameData.players );
		expect( handsUpdatedSpy ).toHaveBeenCalledWith( mockAskMove, cardsData );
		expect( scoreUpdatedSpy ).toHaveBeenCalledWith( mockAskMove, mockGameData.players, mockGameData.teams );
		expect( turnUpdatedSpy ).toHaveBeenCalledWith( mockGameData.currentTurn, mockAskMove, mockGameData.players );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.MOVE_CREATED,
			mockAskMove
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handlePlayerJoined", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should publish Player joined event to the game room", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		await service.handlePlayerJoined( "1", mockPlayer1, false );


		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.PLAYER_JOINED,
			mockPlayer1
		);
	} );

	it( "should publish Player joined event to the game room", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const updateStatusSpy = vi.spyOn( service, "updateStatus" ).mockResolvedValue( mockDeep() );

		await service.handlePlayerJoined( "1", mockPlayer1, true );


		expect( updateStatusSpy ).toHaveBeenCalledWith( "1", GameStatus.PLAYERS_READY );
		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.PLAYER_JOINED,
			mockPlayer1
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleScoreUpdated", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS );
	const mockScoreUpdate: ScoreUpdate = {
		teamId: mockTeamA.id,
		score: 6,
		setWon: CardSet.LOWER_CLUBS
	};

	it( "should publish Score Update event to the game room", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		await service.handleScoreUpdated( mockGameData.id, mockGameData.teams, mockScoreUpdate );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.SCORE_UPDATED,
			mockScoreUpdate
		);
	} );

	it( "should publish score updated event to the game room and complete game if all sets done", async () => {
		mockGameData.teams[ mockTeamA.id ].setsWon = [ ...CARD_SETS.slice( 1 ) ];
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const updateStatusSpy = vi.spyOn( service, "updateStatus" ).mockResolvedValue( mockDeep() );

		await service.handleScoreUpdated( mockGameData.id, mockGameData.teams, mockScoreUpdate );

		expect( updateStatusSpy ).toHaveBeenCalledWith( "1", GameStatus.COMPLETED );
		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.SCORE_UPDATED,
			mockScoreUpdate
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleStatusUpdated", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should publish status updated event to the room", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		await service.handleStatusUpdated( "1", GameStatus.IN_PROGRESS );


		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.STATUS_UPDATED,
			GameStatus.IN_PROGRESS
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleTeamsCreated", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const teamData: TeamData = {
		[ mockTeamA.id ]: { ...mockTeamA, members: [ mockPlayer1.id, mockPlayer3.id ] },
		[ mockTeamB.id ]: { ...mockTeamB, members: [ mockPlayer2.id, mockPlayer4.id ] }
	};

	it( "should publish teams created message to the room", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		const updateStatusSpy = vi.spyOn( service, "updateStatus" ).mockResolvedValue( mockDeep() );
		await service.handleTeamsCreated( "1", teamData );

		expect( updateStatusSpy ).toHaveBeenCalledWith( "1", GameStatus.TEAMS_CREATED );
		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.TEAMS_CREATED,
			teamData
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleTurnUpdated", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should publish turn updated event to the room", async () => {
		const service = new LiteratureService( mockPrisma, mockRealtimeService, mockValidators, mockTransformers );
		await service.handleTurnUpdated( "1", { "2": mockPlayer1 }, "2" );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.TURN_UPDATED,
			"2"
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );