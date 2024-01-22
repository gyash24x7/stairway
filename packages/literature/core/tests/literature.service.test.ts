import { CARD_SETS, CardSet, getCardSetsInHand, getPlayingCardFromId } from "@common/cards";
import type { RealtimeService } from "@common/core";
import type { LiteratureRepository } from "@common/data";
import type {
	CardMapping,
	CreateGameInput,
	CreateTeamsInput,
	Game,
	GameData,
	JoinGameInput,
	Move,
	Player,
	ScoreUpdate,
	TeamData
} from "@literature/data";
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
} from "./mock-utils";

describe( "LiteratureService::askCard", () => {
	const mockInput = mockAskCardInput;

	const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
		if ( card.id === mockInput.askedFor ) {
			return { cardId: card.id, playerId: mockPlayer2.id, gameId: "1" };
		}
		return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
	} );

	const cardsData = buildCardsData( cardMappingList );

	const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
	const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should transfer the turn to asked player when asked incorrectly and create ask move", async () => {
		const askMove = { ...mockAskMove, data: { ...mockAskMove.data as any, from: mockPlayer4.id } };
		mockValidators.askCard.mockResolvedValue( { askedPlayer: mockPlayer4, playerWithAskedCard: mockPlayer1 } );
		mockRepository.createMove.mockResolvedValue( askMove );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const moveCreatedSpy = vi.spyOn( service, "handleMoveCreated" ).mockImplementation( async () => {} );
		const getCardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( cardsData );

		const result = await service.askCard(
			{ ...mockInput, askedFrom: mockPlayer4.id },
			mockGameData,
			mockPlayerSpecificData
		);

		expect( result ).toEqual( askMove );
		expect( mockRepository.createMove ).toBeCalledTimes( 1 );
		expect( mockRepository.createMove ).toBeCalledWith( {
			type: "ASK_CARD",
			gameId: mockGameData.id,
			success: false,
			data: {
				from: mockPlayer4.id,
				by: mockAuthUser.id,
				card: mockInput.askedFor
			},
			description: `${ mockPlayer1.name } asked ${ mockPlayer4.name } for ${ mockInput.askedFor } and was declined!`
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
		mockRepository.createMove.mockResolvedValue( mockAskMove );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const moveCreatedSpy = vi.spyOn( service, "handleMoveCreated" ).mockImplementation( async () => {} );
		const getCardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( cardsData );

		const result = await service.askCard( mockInput, mockGameData, mockPlayerSpecificData );

		expect( result ).toEqual( mockAskMove );
		expect( mockRepository.createMove ).toBeCalledTimes( 1 );
		expect( mockRepository.createMove ).toBeCalledWith( {
			type: "ASK_CARD",
			gameId: mockGameData.id,
			success: true,
			data: {
				from: mockInput.askedFrom,
				by: mockAuthUser.id,
				card: mockInput.askedFor
			},
			description: `${ mockPlayer1.name } asked ${ mockPlayer2.name } for ${ mockInput.askedFor } and got the card!`
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
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );

} );

describe( "LiteratureService::callSet", () => {

	const mockInput = mockCallSetInput;

	const mockRepository = mockDeep<LiteratureRepository>();
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

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
		const mockMove: Move = {
			...mockCallMove,
			success: false,
			data: { ...mockCallMove.data as any, correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id } },
			description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } incorrectly!`
		};

		mockRepository.createMove.mockResolvedValue( mockMove );
		mockValidators.callSet.mockResolvedValue( {
			correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id },
			calledSet: CardSet.LOWER_CLUBS
		} );

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const moveCreatedSpy = vi.spyOn( service, "handleMoveCreated" ).mockImplementation( async () => {} );
		const getCardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( cardsData );

		const result = await service.callSet( mockInput, mockGameData, mockPlayerSpecificData );

		expect( result ).toEqual( mockMove );
		expect( mockRepository.createMove ).toHaveBeenCalledWith( {
			gameId: mockGameData.id,
			type: "CALL_SET",
			success: false,
			description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } incorrectly!`,
			data: {
				by: mockPlayer1.id,
				cardSet: CardSet.LOWER_CLUBS,
				actualCall: mockInput.data,
				correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id }
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

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		mockRepository.createMove.mockResolvedValue( mockCallMove );
		mockValidators.callSet.mockResolvedValue( {
			correctCall: mockInput.data,
			calledSet: CardSet.LOWER_CLUBS
		} );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const moveCreatedSpy = vi.spyOn( service, "handleMoveCreated" ).mockImplementation( async () => {} );
		const getCardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( cardsData );

		const result = await service.callSet( mockInput, mockGameData, mockPlayerSpecificData );

		expect( result ).toEqual( mockCallMove );
		expect( mockRepository.createMove ).toHaveBeenCalledWith( {
			gameId: mockGameData.id,
			type: "CALL_SET",
			success: true,
			description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } correctly!`,
			data: {
				by: mockPlayer1.id,
				cardSet: CardSet.LOWER_CLUBS,
				actualCall: mockInput.data,
				correctCall: mockInput.data
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
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::createGame", () => {

	const mockInput: CreateGameInput = {
		playerCount: 4
	};

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const mockGame = mockDeep<Game>();
	const mockNewPlayer = mockDeep<Player>();
	const mockGameData = mockDeep<GameData>();
	mockGame.id = "game123";
	mockGameData.id = "game123";

	it( "should create a new game and add the logged in player", async () => {
		mockRepository.createGame.mockResolvedValue( mockGame );
		mockRepository.createPlayer.mockResolvedValue( mockNewPlayer );
		mockTransformers.gameData.mockReturnValue( mockGameData );

		const service = new LiteratureService(
			mockRepository,
			mockRealtimeService,
			mockValidators,
			mockTransformers
		);

		const result = await service.createGame( mockInput, mockAuthUser );

		expect( result.id ).toEqual( mockGame.id );

		expect( mockRepository.createGame ).toHaveBeenCalledWith(
			expect.objectContaining( {
				playerCount: 4,
				currentTurn: mockPlayer1.id
			} )
		);

		expect( mockRepository.createPlayer ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: mockPlayer1.id,
				gameId: "game123"
			} )
		);

		expect( mockTransformers.gameData ).toHaveBeenCalledWith( {
			...mockGame,
			players: [ mockNewPlayer ],
			cardMappings: [],
			teams: [],
			moves: []
		} );
	} );


	afterEach( () => {
		mockClear( mockRepository );
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

	const mockGameData = buildMockGameData( "PLAYERS_READY" );

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should create teams and assign teams to players", async () => {
		mockRepository.createTeams.mockResolvedValueOnce( [ mockTeamA, mockTeamB ] );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const teamsCreatedSpy = vi.spyOn( service, "handleTeamsCreated" ).mockImplementation( async () => {} );

		const result = await service.createTeams( mockInput, mockGameData );

		expect( result ).toEqual( {
			[ mockTeamA.id ]: { ...mockTeamA, memberIds: mockInput.data[ mockTeamA.name ] },
			[ mockTeamB.id ]: { ...mockTeamB, memberIds: mockInput.data[ mockTeamB.name ] }
		} );

		expect( mockRepository.createTeams ).toHaveBeenCalledTimes( 1 );
		expect( mockRepository.createTeams ).toHaveBeenCalledWith( [
			{ name: "Team A", gameId: "1", memberIds: [ "1", "3" ] },
			{ name: "Team B", gameId: "1", memberIds: [ "2", "4" ] }
		] );

		expect( teamsCreatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( teamsCreatedSpy ).toHaveBeenCalledWith( mockGameData.id, result );
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::joinGame", () => {
	const mockInput: JoinGameInput = { code: "BCDEDIT" };
	const mockGame = buildMockRawGameData( "CREATED" );

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should return game if user already part of game", async () => {
		mockValidators.joinGame.mockResolvedValue( { game: mockGame, isUserAlreadyInGame: true } );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
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
		mockRepository.createPlayer.mockResolvedValue( mockPlayer1 );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const playerJoinedSpy = vi.spyOn( service, "handlePlayerJoined" ).mockImplementation( async () => {} );

		const gameWithPlayers = await service.joinGame( mockInput, mockAuthUser );

		expect( mockRepository.createPlayer ).toHaveBeenCalledWith( {
			id: mockAuthUser.id,
			name: mockAuthUser.name,
			gameId: mockGame.id
		} );
		expect( mockValidators.joinGame ).toHaveBeenCalledWith( { input: mockInput, authUser: mockAuthUser } );
		expect( gameWithPlayers.players ).toEqual( [ mockPlayer2, mockPlayer4, mockPlayer3, mockPlayer1 ] );
		expect( playerJoinedSpy ).toHaveBeenCalledTimes( 1 );
		expect( playerJoinedSpy ).toHaveBeenCalledWith( mockGame.id, mockPlayer1, false );
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::startGame", () => {
	const mockGameData = buildMockGameData( "TEAMS_CREATED" );

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should create card mappings and start the game", async () => {

		const cardMappingList: CardMapping[] = [];
		deck.forEach( ( card, index ) => {
			const cardMapping = {
				cardId: card.id,
				gameId: mockGameData.id,
				playerId: mockPlayerIds[ index % mockGameData.playerCount ]
			};
			cardMappingList.push( cardMapping );
		} );

		mockRepository.createCardMappings.mockResolvedValue( cardMappingList );

		const cardsData = buildCardsData( cardMappingList );
		mockTransformers.cardsData.mockReturnValue( cardsData );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const gameStartedSpy = vi.spyOn( service, "handleGameStarted" ).mockImplementation( async () => {} );
		await service.startGame( mockGameData );

		expect( mockRepository.createCardMappings ).toHaveBeenCalledTimes( 1 );
		expect( mockTransformers.cardsData ).toHaveBeenCalledWith( cardMappingList );
		expect( gameStartedSpy ).toHaveBeenCalledTimes( 1 );
		expect( gameStartedSpy ).toHaveBeenCalledWith( mockGameData, cardsData );
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::transferTurn", () => {

	const mockInput = mockTransferTurnInput;
	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should transfer turn to another player", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList, [ mockCallMove ] );

		mockRepository.createMove.mockResolvedValue( mockTransferMove );
		mockValidators.transferTurn.mockResolvedValue( {
			transferringPlayer: mockPlayer1,
			receivingPlayer: mockPlayer3
		} );

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const moveCreatedSpy = vi.spyOn( service, "handleMoveCreated" ).mockImplementation( async () => {} );
		const getCardsDataSpy = vi.spyOn( service, "getCardsData" ).mockResolvedValue( cardsData );

		const result = await service.transferTurn( mockInput, mockGameData, mockPlayerSpecificData );

		expect( result ).toEqual( mockTransferMove );
		expect( mockRepository.createMove ).toHaveBeenCalledTimes( 1 );
		expect( mockRepository.createMove ).toHaveBeenCalledWith( {
			gameId: mockGameData.id,
			type: "TRANSFER_TURN",
			success: true,
			data: {
				to: mockInput.transferTo,
				from: mockAuthUser.id
			},
			description: `${ mockPlayer1.name } transferred the turn to ${ mockPlayer3.name }`
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
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::updateHands", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappingList = buildMockCardMappings();
	const cardsData = buildCardsData( cardMappingList );

	it( "should transfer the card to the player who asked for it on successful ask", async () => {
		cardsData.mappings[ mockAskMove.data.card ] = mockAskMove.data.from;
		const card = getPlayingCardFromId( mockAskMove.data.card );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const handsUpdatedSpy = vi.spyOn( service, "handleHandsUpdated" ).mockImplementation( async () => {} );

		const updatedHands = await service.updateHands( mockAskMove, cardsData );

		expect( updatedHands[ mockAskMove.data.by ] ).toContainEqual( card );
		expect( updatedHands[ mockAskMove.data.from ] ).not.toContainEqual( card );

		expect( mockRepository.updateCardMapping ).toHaveBeenCalledWith(
			mockAskMove.data.card,
			mockAskMove.gameId,
			mockAskMove.data.by
		);
		expect( handsUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( handsUpdatedSpy ).toHaveBeenCalledWith( mockAskMove.gameId, updatedHands );
	} );

	it( "should do nothing on unsuccessful ask", async () => {
		cardsData.mappings[ mockAskMove.data.card ] = mockAskMove.data.from;
		const card = getPlayingCardFromId( mockAskMove.data.card );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const handsUpdatedSpy = vi.spyOn( service, "handleHandsUpdated" ).mockImplementation( async () => {} );

		const updatedHands = await service.updateHands( { ...mockAskMove, success: false }, cardsData );

		expect( updatedHands[ mockAskMove.data.by ] ).not.toContainEqual( card );
		expect( updatedHands[ mockAskMove.data.from ] ).toContainEqual( card );

		expect( mockRepository.updateCardMapping ).toHaveBeenCalledTimes( 0 );
		expect( handsUpdatedSpy ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should remove the cards of that set on successful call", async () => {
		const calledSet = mockCallMove.data.cardSet;
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const handsUpdatedSpy = vi.spyOn( service, "handleHandsUpdated" ).mockImplementation( async () => {} );

		const updatedHands = await service.updateHands( mockCallMove, cardsData );

		const allCardsOfCalledSet = Object.values( updatedHands ).flat().filter( card => card.set === calledSet );
		const calledCards = Object.keys( mockCallMove.data.correctCall );

		expect( allCardsOfCalledSet ).toHaveLength( 0 );
		expect( mockRepository.deleteCardMappings ).toHaveBeenCalledWith( calledCards, mockCallMove.gameId );
		expect( handsUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( handsUpdatedSpy ).toHaveBeenCalledWith( mockCallMove.gameId, updatedHands );

	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::updateStatus", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should update game status and publish StatusUpdatedEvent", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const statusUpdatedSpy = vi.spyOn( service, "handleStatusUpdated" ).mockImplementation( async () => {} );

		await service.updateStatus( "1", "TEAMS_CREATED" );

		expect( mockRepository.updateGameStatus ).toHaveBeenCalledTimes( 1 );
		expect( mockRepository.updateGameStatus ).toHaveBeenCalledWith( "1", "TEAMS_CREATED" );
		expect( statusUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( statusUpdatedSpy ).toHaveBeenCalledWith( "1", "TEAMS_CREATED" );
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::updateScore", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const mockGameData = buildMockGameData( "IN_PROGRESS" );

	it( "should not update score if currentMove is not valid", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const scoreUpdatedSpy = vi.spyOn( service, "handleScoreUpdated" ).mockImplementation( async () => {} );

		const scoreUpdate = await service.updateScore( mockAskMove, mockGameData.players, mockGameData.teams );
		expect( scoreUpdate ).toBeUndefined();
		expect( mockRepository.updateTeamScore ).toHaveBeenCalledTimes( 0 );
		expect( scoreUpdatedSpy ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should update score of opposing team if currentMove is not successful", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const scoreUpdatedSpy = vi.spyOn( service, "handleScoreUpdated" ).mockImplementation( async () => {} );

		const scoreUpdate = await service.updateScore(
			{ ...mockCallMove, success: false },
			mockGameData.players,
			mockGameData.teams
		);

		expect( scoreUpdate?.teamId ).toEqual( mockTeamB.id );
		expect( scoreUpdate?.score ).toEqual( 1 );
		expect( scoreUpdate?.setWon ).toEqual( CardSet.LOWER_CLUBS );

		expect( mockRepository.updateTeamScore ).toHaveBeenCalledWith( mockTeamB.id, mockTeamB.score + 1 );
		expect( scoreUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( scoreUpdatedSpy ).toHaveBeenCalledWith( mockGameData.id, mockGameData.teams, scoreUpdate! );
	} );

	it( "should update score of the team if currentMove is successful", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const scoreUpdatedSpy = vi.spyOn( service, "handleScoreUpdated" ).mockImplementation( async () => {} );

		const scoreUpdate = await service.updateScore( mockCallMove, mockGameData.players, mockGameData.teams );

		expect( scoreUpdate?.teamId ).toEqual( mockTeamA.id );
		expect( scoreUpdate?.score ).toEqual( 1 );
		expect( scoreUpdate?.setWon ).toEqual( CardSet.LOWER_CLUBS );

		expect( mockRepository.updateTeamScore ).toHaveBeenCalledWith( mockTeamA.id, mockTeamA.score + 1 );
		expect( scoreUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( scoreUpdatedSpy ).toHaveBeenCalledWith( mockGameData.id, mockGameData.teams, scoreUpdate! );
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::updateTurn", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const mockGameData = buildMockGameData( "IN_PROGRESS" );

	it( "should do nothing on a successful ask", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const turnUpdatedSpy = vi.spyOn( service, "handleTurnUpdated" ).mockImplementation( async () => {} );

		const updatedTurn = await service.updateTurn( mockGameData.currentTurn, mockAskMove, mockGameData.players );

		expect( updatedTurn ).toEqual( mockAskMove.data.by );
		expect( mockRepository.updateCurrentTurn ).toHaveBeenCalledTimes( 0 );
		expect( turnUpdatedSpy ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should update turn to asked player on unsuccessful ask", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const turnUpdatedSpy = vi.spyOn( service, "handleTurnUpdated" ).mockImplementation( async () => {} );

		const updatedTurn = await service.updateTurn(
			mockGameData.currentTurn,
			{ ...mockAskMove, success: false },
			mockGameData.players
		);

		expect( updatedTurn ).toEqual( mockAskMove.data.from );
		expect( mockRepository.updateCurrentTurn ).toHaveBeenCalledWith( mockAskMove.gameId, updatedTurn );
		expect( turnUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( turnUpdatedSpy ).toHaveBeenCalledWith( mockAskMove.gameId, mockGameData.players, updatedTurn );
	} );

	it( "should do nothing on successful call", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const turnUpdatedSpy = vi.spyOn( service, "handleTurnUpdated" ).mockImplementation( async () => {} );
		const updatedTurn = await service.updateTurn( mockGameData.currentTurn, mockCallMove, mockGameData.players );

		expect( updatedTurn ).toEqual( mockCallMove.data.by );
		expect( mockRepository.updateCurrentTurn ).toHaveBeenCalledTimes( 0 );
		expect( turnUpdatedSpy ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should update turn to random player of opposite team on unsuccessful call", async () => {
		const callingPlayer = mockGameData.players[ mockCallMove.data.by ];
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const turnUpdatedSpy = vi.spyOn( service, "handleTurnUpdated" ).mockImplementation( async () => {} );
		const updatedTurn = await service.updateTurn(
			mockGameData.currentTurn,
			{ ...mockCallMove, success: false },
			mockGameData.players
		);

		const receivedPlayer = mockGameData.players[ updatedTurn ];
		expect( receivedPlayer.teamId ).not.toEqual( callingPlayer.teamId );
		expect( mockRepository.updateCurrentTurn ).toHaveBeenCalledWith( mockCallMove.gameId, updatedTurn );
		expect( turnUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( turnUpdatedSpy ).toHaveBeenCalledWith( mockCallMove.gameId, mockGameData.players, updatedTurn );
	} );

	it( "should update turn to mentioned player on transfer turn", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const turnUpdatedSpy = vi.spyOn( service, "handleTurnUpdated" ).mockImplementation( async () => {} );

		const updatedTurn = await service.updateTurn(
			mockGameData.currentTurn,
			mockTransferMove,
			mockGameData.players
		);

		expect( updatedTurn ).toEqual( mockTransferMove.data.to );
		expect( mockRepository.updateCurrentTurn ).toHaveBeenCalledWith( mockAskMove.gameId, updatedTurn );
		expect( turnUpdatedSpy ).toHaveBeenCalledTimes( 1 );
		expect( turnUpdatedSpy ).toHaveBeenCalledWith( mockAskMove.gameId, mockGameData.players, updatedTurn );
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::getCardsData", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappings = buildMockCardMappings();

	it( "should fetch card player mappings", async () => {
		mockRepository.getCardMappings.mockResolvedValue( cardMappings );
		mockTransformers.cardsData.mockReturnValue( buildCardsData( cardMappings ) );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const result = await service.getCardsData( "1" );

		const randomIndex = Math.floor( Math.random() * deck.length );
		const randomCardMapping = cardMappings[ randomIndex ];

		expect( Object.keys( result.mappings ).length ).toEqual( deck.length );
		expect( Object.keys( result.hands ).length ).toEqual( 4 );
		expect( result.mappings[ randomCardMapping.cardId ] ).toEqual( randomCardMapping.playerId );
		expect( mockTransformers.cardsData ).toHaveBeenCalledWith( cardMappings );
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::getGameData", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappings = buildMockCardMappings();
	const mockMoves = [ mockTransferMove, mockCallMove, mockAskMove ];

	it( "should fetch aggregated game data", async () => {
		const rawGameData = buildMockRawGameData( "IN_PROGRESS", cardMappings, mockMoves );
		mockRepository.getGameById.mockResolvedValue( rawGameData as any );
		mockTransformers.gameData.mockReturnValue( buildGameData( rawGameData ) );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const result = await service.getGameData( "1" );

		expect( result?.id ).toEqual( "1" );
		expect( result?.status ).toEqual( "IN_PROGRESS" );
		expect( result?.teams ).toEqual( {
			[ mockTeamA.id ]: { ...mockTeamA, memberIds: [ mockPlayer1.id, mockPlayer3.id ] },
			[ mockTeamB.id ]: { ...mockTeamB, memberIds: [ mockPlayer2.id, mockPlayer4.id ] }
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
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::getPlayerSpecificData", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappings = buildMockCardMappings();
	const { hands } = buildCardsData( cardMappings );

	it( "should return the current game data for the player when teams not created", async () => {
		const mockGameData = buildMockGameData( "PLAYERS_READY" );

		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
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
		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappings );
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const cardsDataSpy = vi.spyOn( service, "getCardsData" )
			.mockResolvedValue( buildCardsData( cardMappingsForPlayer ) );

		const result = await service.getPlayerSpecificData( mockGameData, mockAuthUser.id );

		expect( result.teamId ).toEqual( mockTeamA.id );
		expect( result.oppositeTeamId ).toEqual( mockTeamB.id );
		expect( result.hand ).toEqual( hands[ mockAuthUser.id ] );
		expect( result.cardSets ).toEqual( getCardSetsInHand( hands[ mockAuthUser.id ] ) );
		expect( cardsDataSpy ).toHaveBeenCalledTimes( 1 );
		expect( cardsDataSpy ).toHaveBeenCalledWith( mockGameData.id, mockAuthUser.id );
	} );


	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleGameStarted", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardsData = buildCardsData( buildMockCardMappings() );
	const mockGameData = buildMockGameData( "TEAMS_CREATED" );


	it( "should update status and publish hand updated message to the players", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const updateStatusSpy = vi.spyOn( service, "updateStatus" ).mockResolvedValue( mockDeep() );
		const handsUpdatedSpy = vi.spyOn( service, "handleHandsUpdated" ).mockImplementation( async () => {} );

		await service.handleGameStarted( mockGameData, cardsData );

		expect( updateStatusSpy ).toHaveBeenCalledWith( mockGameData.id, "IN_PROGRESS" );
		expect( handsUpdatedSpy ).toHaveBeenCalledWith( mockGameData.id, cardsData.hands );
	} );


	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleHandsUpdated", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const { hands } = buildCardsData( buildMockCardMappings() );
	const mockGameData = buildMockGameData( "TEAMS_CREATED" );

	it( "should publish hand updated message to the players", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );

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
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleInferencesUpdated", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappingList = buildMockCardMappings();
	const inferenceData = buildMockInferenceData( "1", cardMappingList );

	it( "should publish inferences updated message to the players", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );

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
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleMoveCreated", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const cardMappingList = buildMockCardMappings();
	const cardsData = buildCardsData( cardMappingList );
	const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList, [ mockCallMove ] );


	it( "should update hands, inferences, score and turn when move created", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const handsUpdatedSpy = vi.spyOn( service, "updateHands" ).mockResolvedValue( cardsData.hands );
		const scoreUpdatedSpy = vi.spyOn( service, "updateScore" ).mockResolvedValue( mockDeep() );
		const turnUpdatedSpy = vi.spyOn( service, "updateTurn" ).mockResolvedValue( mockDeep() );

		await service.handleMoveCreated( mockAskMove, mockGameData, cardsData );

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
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handlePlayerJoined", () => {

	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should publish Player joined event to the game room", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		await service.handlePlayerJoined( "1", mockPlayer1, false );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.PLAYER_JOINED,
			mockPlayer1
		);
	} );

	it( "should publish Player joined event to the game room", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const updateStatusSpy = vi.spyOn( service, "updateStatus" ).mockResolvedValue( mockDeep() );

		await service.handlePlayerJoined( "1", mockPlayer1, true );

		expect( updateStatusSpy ).toHaveBeenCalledWith( "1", "PLAYERS_READY" );
		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.PLAYER_JOINED,
			mockPlayer1
		);
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleScoreUpdated", () => {
	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const mockGameData = buildMockGameData( "IN_PROGRESS" );
	const mockScoreUpdate: ScoreUpdate = {
		teamId: mockTeamA.id,
		score: 6,
		setWon: CardSet.LOWER_CLUBS
	};

	it( "should publish Score Update event to the game room", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
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
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const updateStatusSpy = vi.spyOn( service, "updateStatus" ).mockResolvedValue( mockDeep() );

		await service.handleScoreUpdated( mockGameData.id, mockGameData.teams, mockScoreUpdate );

		expect( updateStatusSpy ).toHaveBeenCalledWith( "1", "COMPLETED" );
		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.SCORE_UPDATED,
			mockScoreUpdate
		);
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleStatusUpdated", () => {
	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should publish status updated event to the room", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		await service.handleStatusUpdated( "1", "IN_PROGRESS" );


		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.STATUS_UPDATED,
			"IN_PROGRESS"
		);
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleTeamsCreated", () => {
	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	const teamData: TeamData = {
		[ mockTeamA.id ]: { ...mockTeamA, memberIds: [ mockPlayer1.id, mockPlayer3.id ] },
		[ mockTeamB.id ]: { ...mockTeamB, memberIds: [ mockPlayer2.id, mockPlayer4.id ] }
	};

	it( "should publish teams created message to the room", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		const updateStatusSpy = vi.spyOn( service, "updateStatus" ).mockResolvedValue( mockDeep() );
		await service.handleTeamsCreated( "1", teamData );

		expect( updateStatusSpy ).toHaveBeenCalledWith( "1", "TEAMS_CREATED" );
		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.TEAMS_CREATED,
			teamData
		);
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );

describe( "LiteratureService::handleTurnUpdated", () => {
	const mockRepository = mockDeep<LiteratureRepository>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockValidators = mockDeep<LiteratureValidators>();
	const mockTransformers = mockDeep<LiteratureTransformers>();

	it( "should publish turn updated event to the room", async () => {
		const service = new LiteratureService( mockRepository, mockRealtimeService, mockValidators, mockTransformers );
		await service.handleTurnUpdated( "1", { "2": mockPlayer1 }, "2" );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.TURN_UPDATED,
			"2"
		);
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockRealtimeService );
		mockClear( mockValidators );
		mockClear( mockTransformers );
	} );
} );