import {
	CardMapping,
	CreateGameInput,
	CreateTeamsInput,
	Game,
	GameStatus,
	JoinGameInput,
	Move,
	MoveType
} from "@literature/types";
import { CardSet, getPlayingCardFromId } from "@s2h/cards";
import type { PrismaService, RealtimeService } from "@s2h/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { LiteratureService } from "../src/literature.service";
import type { LiteratureTransformers } from "../src/literature.transformers";
import type { LiteratureValidators } from "../src/literature.validators";
import {
	buildMockCardMappings,
	buildMockGameData,
	buildMockInferenceData,
	buildMockRawGameData,
	buildPlayerSpecificData,
	deck,
	mockAskCardInput as mockInput,
	mockAskMove,
	mockAuthUser,
	mockCallMove,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayer4,
	mockPlayerIds,
	mockTeamA,
	mockTeamB,
	mockTransferMove
} from "./mockdata";
import { buildCardsData } from "./mockdata/utils";

describe( "LiteratureService::askCard", () => {

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
		mockValidator.validate.mockResolvedValue( {
			correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id },
			calledSet: CardSet.LOWER_CLUBS
		} );

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( mockInput, mockGameData, mockPlayerSpecificData, cardsData );

		const handler = new CallSetCommandHandler( mockPrisma, mockValidator, mockEventBus );
		const result = await handler.execute( command );

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

		expect( mockValidator.validate ).toHaveBeenCalledWith( command );

		const event = new MoveCreatedEvent( mockMove, mockGameData, cardsData );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
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
		const command = new CallSetCommand( mockInput, mockGameData, mockPlayerSpecificData, cardsData );

		mockPrisma.literature.move.create.mockResolvedValue( mockCallMove );
		mockValidator.validate.mockResolvedValue( {
			correctCall: mockInput.data,
			calledSet: CardSet.LOWER_CLUBS
		} );

		const handler = new CallSetCommandHandler( mockPrisma, mockValidator, mockEventBus );
		const result = await handler.execute( command );

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

		expect( mockValidator.validate ).toHaveBeenCalledWith( command );

		const event = new MoveCreatedEvent( mockCallMove, mockGameData, cardsData );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
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

	const transformer = new GameDataTransformer();
	const mockGame = mockDeep<Game>();
	mockGame.id = "game123";

	it( "should create a new game and add the logged in player", async () => {
		mockPrisma.literature.game.create.mockResolvedValue( mockGame );
		mockPrisma.literature.player.create.mockResolvedValue( mockDeep() );

		const createGameCommandHandler = new CreateGameCommandHandler( mockPrisma, transformer );
		await createGameCommandHandler.execute( new CreateGameCommand( mockInput, mockAuthUser ) );

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

		const handler = new CreateInferenceCommandHandler( mockPrisma, mockEventBus );
		const command = new CreateInferenceCommand( mockGameData, hands );

		await handler.execute( command );

		expect( mock ).toHaveBeenCalledTimes( 4 );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "1" ] } );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "2" ] } );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "3" ] } );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "4" ] } );

		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 1 );
		const event = new InferenceUpdatedEvent( "1", inferenceData );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );

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
		const handler = new CreateTeamsCommandHandler( mockPrisma, mockValidator, mockEventBus );
		const result = await handler.execute( new CreateTeamsCommand( mockInput, mockGameData ) );

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

		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 1 );
		const event = new TeamsCreatedEvent( mockGameData.id, result );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
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
		mockValidator.validate.mockResolvedValue( { game: mockGame, isUserAlreadyInGame: true } );

		const commandHandler = new JoinGameCommandHandler( mockPrisma, mockValidator, mockEventBus );
		const gameWithPlayers = await commandHandler.execute( new JoinGameCommand( mockInput, mockAuthUser ) );

		expect( gameWithPlayers.players ).toEqual( [
			{ ...mockPlayer1, teamId: null },
			{ ...mockPlayer2, teamId: null },
			{ ...mockPlayer3, teamId: null },
			{ ...mockPlayer4, teamId: null }
		] );
	} );

	it( "should add user to the game and publish game update event", async () => {
		mockValidator.validate.mockResolvedValue( {
			game: {
				...mockGame,
				playerCount: 6,
				players: [ mockPlayer2, mockPlayer4, mockPlayer3 ]
			},
			isUserAlreadyInGame: false
		} );
		mockPrisma.literature.player.create.mockResolvedValue( mockPlayer1 );

		const commandHandler = new JoinGameCommandHandler( mockPrisma, mockValidator, mockEventBus );
		const gameWithPlayers = await commandHandler.execute( new JoinGameCommand( mockInput, mockAuthUser ) );

		expect( mockPrisma.literature.player.create ).toHaveBeenCalledWith( {
			data: {
				id: mockAuthUser.id,
				name: mockAuthUser.name,
				avatar: mockAuthUser.avatar,
				gameId: mockGame.id
			}
		} );

		expect( gameWithPlayers.players ).toEqual( [ mockPlayer2, mockPlayer4, mockPlayer3, mockPlayer1 ] );

		const event = new PlayerJoinedEvent( mockGame.id, mockPlayer1, false );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
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

		const handler = new StartGameCommandHandler( mockPrisma, mockEventBus, transformer );
		const result = await handler.execute( new StartGameCommand( mockGameData ) );

		expect( result ).toEqual( cardMappingList );
		expect( mock ).toHaveBeenCalledTimes( deck.length );
		expect( mockEventBus.publish ).toHaveBeenCalledWith(
			new GameStartedEvent( mockGameData, buildCardsData( cardMappingList ) )
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::transferTurn", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should transfer turn to another player", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );

		const mockGameData = buildMockGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockCallMove ]
		);

		mockPrisma.literature.move.create.mockResolvedValue( mockTransferMove );
		mockValidator.validate.mockResolvedValue( { transferringPlayer: mockPlayer1, receivingPlayer: mockPlayer3 } );

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const handler = new TransferTurnCommandHandler( mockPrisma, mockValidator, mockEventBus );
		const command = new TransferTurnValidatorInput( mockInput, mockGameData, mockPlayerSpecificData, cardsData );

		const result = await handler.execute( command );

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
		expect( mockEventBus.publish )
			.toHaveBeenCalledWith( new MoveCreatedEvent( mockTransferMove, mockGameData, cardsData ) );
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

		const handler = new UpdateHandsCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateHandsCommand( mockAskMove, cardsData );

		const updatedHands = await handler.execute( command );

		expect( updatedHands[ mockAskMove.data.by ] ).toContainEqual( card );
		expect( updatedHands[ mockAskMove.data.from ] ).not.toContainEqual( card );

		expect( mockPrisma.literature.cardMapping.update ).toHaveBeenCalledWith( {
			where: { cardId_gameId: { gameId: mockAskMove.gameId, cardId: mockAskMove.data.card } },
			data: { playerId: mockAskMove.data.by }
		} );

		const event = new HandsUpdatedEvent( mockAskMove.gameId, updatedHands );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should do nothing on unsuccessful ask", async () => {
		cardsData.mappings[ mockAskMove.data.card ] = mockAskMove.data.from;
		const card = getPlayingCardFromId( mockAskMove.data.card );

		const handler = new UpdateHandsCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateHandsCommand( { ...mockAskMove, success: false }, cardsData );

		const updatedHands = await handler.execute( command );

		expect( updatedHands[ mockAskMove.data.by ] ).not.toContainEqual( card );
		expect( updatedHands[ mockAskMove.data.from ] ).toContainEqual( card );

		expect( mockPrisma.literature.cardMapping.update ).toHaveBeenCalledTimes( 0 );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should remove the cards of that set on successful call", async () => {
		const calledSet = mockCallMove.data.cardSet;
		const handler = new UpdateHandsCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateHandsCommand( mockCallMove, cardsData );

		const updatedHands = await handler.execute( command );

		const allCardsOfCalledSet = Object.values( updatedHands ).flat().filter( card => card.set === calledSet );
		const calledCards = Object.keys( mockCallMove.data.correctCall );

		expect( allCardsOfCalledSet ).toHaveLength( 0 );
		expect( mockPrisma.literature.cardMapping.deleteMany ).toHaveBeenCalledWith( {
			where: { cardId: { in: calledCards } }
		} );

		const event = new HandsUpdatedEvent( mockAskMove.gameId, updatedHands );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );

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

	mockQueryBus.execute.mockResolvedValue( mockInferenceData );

	it( "should updated inferences for all players on successful ask", async () => {
		const handler = new UpdateInferenceCommandHandler( mockPrisma, mockQueryBus, mockEventBus );
		const command = new UpdateInferenceCommand( mockAskMove, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		expect( mockQueryBus.execute ).toHaveBeenCalledWith( new InferenceDataQuery( mockAskMove.gameId ) );

		expect( mockPrisma.literature.inference.update ).toHaveBeenCalledTimes( mockGameData.playerCount );
		Object.keys( mockGameData.players ).map( playerId => {
			const { actualCardLocations } = updatedInferences[ playerId ];
			expect( actualCardLocations[ mockAskMove.data.card ] ).toEqual( mockAskMove.data.by );
			expect( mockPrisma.literature.inference.update ).toHaveBeenCalledWith( {
				where: { gameId_playerId: { playerId, gameId: mockAskMove.gameId } },
				data: updatedInferences[ playerId ]
			} );
		} );

		const event = new InferenceUpdatedEvent( mockAskMove.gameId, updatedInferences );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should update inferences for all players on unsuccessful ask", async () => {
		const handler = new UpdateInferenceCommandHandler( mockPrisma, mockQueryBus, mockEventBus );
		const command = new UpdateInferenceCommand( { ...mockAskMove, success: false }, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		expect( mockQueryBus.execute ).toHaveBeenCalledWith( new InferenceDataQuery( mockAskMove.gameId ) );

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

		const event = new InferenceUpdatedEvent( mockAskMove.gameId, updatedInferences );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should remove inferences for the called set for all players on call", async () => {
		const handler = new UpdateInferenceCommandHandler( mockPrisma, mockQueryBus, mockEventBus );
		const command = new UpdateInferenceCommand( mockCallMove, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		expect( mockQueryBus.execute ).toHaveBeenCalledWith( new InferenceDataQuery( mockAskMove.gameId ) );

		const cardsOfCalledSetInInference = Object.values( updatedInferences )
			.flatMap( inference => [
				...Object.keys( inference.possibleCardLocations ),
				...Object.keys( inference.actualCardLocations ),
				...Object.keys( inference.inferredCardLocations )
			] )
			.map( getPlayingCardFromId )
			.filter( card => card.set === mockCallMove.data.cardSet );

		expect( cardsOfCalledSetInInference ).toHaveLength( 0 );
		expect( mockPrisma.literature.inference.update ).toHaveBeenCalledTimes( mockGameData.playerCount );

		Object.keys( mockGameData.players ).map( playerId => {
			expect( mockPrisma.literature.inference.update ).toHaveBeenCalledWith( {
				where: { gameId_playerId: { playerId, gameId: mockAskMove.gameId } },
				data: updatedInferences[ playerId ]
			} );
		} );

		const event = new InferenceUpdatedEvent( mockAskMove.gameId, updatedInferences );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should do nothing if the move is a transfer move", async () => {
		const handler = new UpdateInferenceCommandHandler( mockPrisma, mockQueryBus, mockEventBus );
		const command = new UpdateInferenceCommand( mockTransferMove, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		expect( mockQueryBus.execute ).toHaveBeenCalledWith( new InferenceDataQuery( mockAskMove.gameId ) );

		expect( updatedInferences ).toEqual( mockInferenceData );
		expect( mockPrisma.literature.player.update ).toHaveBeenCalledTimes( 0 );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 0 );
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
		const handler = new UpdateStatusCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateStatusCommand( "1", GameStatus.TEAMS_CREATED );

		await handler.execute( command );

		expect( mockPrisma.literature.game.update ).toHaveBeenCalledTimes( 1 );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: "1" },
			data: { status: GameStatus.TEAMS_CREATED }
		} );

		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 1 );
		const event = new StatusUpdatedEvent( "1", GameStatus.TEAMS_CREATED );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
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
		const handler = new UpdateScoreCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateScoreCommand( mockAskMove, mockGameData.players, mockGameData.teams );

		const scoreUpdate = await handler.execute( command );

		expect( scoreUpdate ).toBeUndefined();
	} );

	it( "should update score of opposing team if currentMove is not successful", async () => {
		mockPrisma.literature.team.update.mockResolvedValue( { ...mockTeamB, score: 1 } );
		const handler = new UpdateScoreCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateScoreCommand(
			{ ...mockCallMove, success: false },
			mockGameData.players,
			mockGameData.teams
		);

		const scoreUpdate = await handler.execute( command );

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

		const event = new ScoreUpdatedEvent( mockGameData.id, mockGameData.teams, scoreUpdate! );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should update score of the team if currentMove is successful", async () => {
		mockPrisma.literature.team.update.mockResolvedValue( { ...mockTeamA, score: 4 } );
		const handler = new UpdateScoreCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateScoreCommand( mockCallMove, mockGameData.players, mockGameData.teams );

		const scoreUpdate = await handler.execute( command );

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

		const event = new ScoreUpdatedEvent( mockGameData.id, mockGameData.teams, scoreUpdate! );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
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
		const handler = new UpdateTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateTurnCommand( mockGameData.currentTurn, mockAskMove, mockGameData.players );

		const updatedTurn = await handler.execute( command );

		expect( updatedTurn ).toEqual( mockAskMove.data.by );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledTimes( 0 );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should update turn to asked player on unsuccessful ask", async () => {
		const handler = new UpdateTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateTurnCommand(
			mockGameData.currentTurn,
			{ ...mockAskMove, success: false },
			mockGameData.players
		);

		const updatedTurn = await handler.execute( command );

		expect( updatedTurn ).toEqual( mockAskMove.data.from );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockAskMove.gameId },
			data: { currentTurn: updatedTurn }
		} );

		const event = new TurnUpdatedEvent( mockAskMove.gameId, updatedTurn, mockGameData.players );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should do nothing on successful call", async () => {
		const handler = new UpdateTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateTurnCommand( mockGameData.currentTurn, mockCallMove, mockGameData.players );

		const updatedTurn = await handler.execute( command );

		expect( updatedTurn ).toEqual( mockCallMove.data.by );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledTimes( 0 );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should update turn to random player of opposite team on unsuccessful call", async () => {
		const callingPlayer = mockGameData.players[ mockCallMove.data.by ];
		const handler = new UpdateTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateTurnCommand(
			mockGameData.currentTurn,
			{ ...mockCallMove, success: false },
			mockGameData.players
		);

		const updatedTurn = await handler.execute( command );

		const receivedPlayer = mockGameData.players[ updatedTurn ];
		expect( receivedPlayer.teamId ).not.toEqual( callingPlayer.teamId );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockCallMove.gameId },
			data: { currentTurn: updatedTurn }
		} );

		const event = new TurnUpdatedEvent( mockAskMove.gameId, updatedTurn, mockGameData.players );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should update turn to mentioned player on transfer turn", async () => {
		const handler = new UpdateTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateTurnCommand( mockGameData.currentTurn, mockTransferMove, mockGameData.players );

		const updatedTurn = await handler.execute( command );

		expect( updatedTurn ).toEqual( mockTransferMove.data.to );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockAskMove.gameId },
			data: { currentTurn: updatedTurn }
		} );

		const event = new TurnUpdatedEvent( mockAskMove.gameId, updatedTurn, mockGameData.players );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );