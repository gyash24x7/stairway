import { afterEach, describe, expect, it } from "vitest";
import type { Game, JoinGameInput, Player } from "@literature/data";
import { GameStatus } from "@literature/data";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import type { EventBus } from "@nestjs/cqrs";
import { JoinGameCommand, JoinGameCommandHandler } from "../../src/commands";
import { GameUpdateEvent } from "../../src/events";
import { buildAggregatedGameData } from "../../src/utils";
import type { HttpException } from "@nestjs/common";
import { Messages } from "../../src/constants";
import { mockAuthInfo, mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 } from "../mockdata";

describe( "JoinGameCommand", () => {

	const mockInput: JoinGameInput = { code: "BCDEDIT" };
	const mockGame = mockDeep<Game & { players: Player[] }>( {
		id: "game123",
		code: "BCDEDIT",
		playerCount: 4,
		status: GameStatus.CREATED,
		players: [ mockPlayer2, mockPlayer3, mockPlayer4 ]
	} );

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();

	it( "should throw error if game not there", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( null );

		const joinGameCommandHandler = new JoinGameCommandHandler( mockPrisma, mockEventBus );

		expect.assertions( 3 );
		await joinGameCommandHandler.execute( new JoinGameCommand( mockInput, mockAuthInfo
		) )
			.catch( ( err: HttpException ) => {
				expect( err.getStatus() ).toEqual( 404 );
				expect( err.message ).toEqual( Messages.GAME_NOT_FOUND );
				expect( mockPrisma.literature.game.findUnique ).toHaveBeenCalledWith( {
					where: { code: mockInput.code },
					include: { players: true }
				} );
			} );
	} );

	it( "should throw error if game has enough players", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( {
			...mockGame,
			players: [ ...mockGame.players, { ...mockPlayer1, id: "5" } ]
		} as any );

		const joinGameCommandHandler = new JoinGameCommandHandler( mockPrisma, mockEventBus );

		expect.assertions( 3 );
		await joinGameCommandHandler.execute( new JoinGameCommand( mockInput, { ...mockAuthInfo, id: "1" } ) )
			.catch( ( err: HttpException ) => {
				expect( err.getStatus() ).toEqual( 400 );
				expect( err.message ).toEqual( Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS );
				expect( mockPrisma.literature.game.findUnique ).toHaveBeenCalledWith( {
					where: { code: mockInput.code },
					include: { players: true }
				} );
			} );
	} );

	it( "should return game id if user already part of game", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( {
			...mockGame,
			players: [ ...mockGame.players, mockPlayer1 ]
		} as any );

		const joinGameCommandHandler = new JoinGameCommandHandler( mockPrisma, mockEventBus );
		const gameId = await joinGameCommandHandler.execute( new JoinGameCommand( mockInput, mockAuthInfo ) );

		expect( mockPrisma.literature.game.findUnique ).toHaveBeenCalledWith( {
			where: { code: mockInput.code },
			include: { players: true }
		} );

		expect( gameId ).toEqual( mockGame.id );
	} );

	it( "should add user to the game and publish game update event", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( { ...mockGame, playerCount: 6 } );
		mockPrisma.literature.player.create.mockResolvedValue( mockPlayer1 );

		const joinGameCommandHandler = new JoinGameCommandHandler( mockPrisma, mockEventBus );
		await joinGameCommandHandler.execute( new JoinGameCommand( mockInput, mockAuthInfo ) );

		expect( mockPrisma.literature.game.findUnique ).toHaveBeenCalledWith( {
			where: { code: mockInput.code },
			include: { players: true }
		} );

		expect( mockPrisma.literature.player.create ).toHaveBeenCalledWith( {
			data: {
				id: mockAuthInfo.id,
				name: mockAuthInfo.name,
				avatar: mockAuthInfo.avatar,
				gameId: mockGame.id
			}
		} );

		const aggregatedMockData = buildAggregatedGameData( {
			...mockGame, playerCount: 6, players: [ ...mockGame.players, mockPlayer1 ]
		} );

		expect( mockGame.status ).toEqual( GameStatus.CREATED );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( new GameUpdateEvent( aggregatedMockData, mockAuthInfo ) );
	} );

	it( "should add user to the game and publish game update event with updated status", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( mockGame );
		mockPrisma.literature.player.create.mockResolvedValue( mockPlayer1 );

		const joinGameCommandHandler = new JoinGameCommandHandler( mockPrisma, mockEventBus );
		await joinGameCommandHandler.execute( new JoinGameCommand( mockInput, mockAuthInfo ) );

		expect( mockPrisma.literature.game.findUnique ).toHaveBeenCalledWith( {
			where: { code: mockInput.code },
			include: { players: true }
		} );

		expect( mockPrisma.literature.player.create ).toHaveBeenCalledWith( {
			data: {
				id: mockAuthInfo.id,
				name: mockAuthInfo.name,
				avatar: mockAuthInfo.avatar,
				gameId: mockGame.id
			}
		} );

		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockGame.id },
			data: { status: GameStatus.PLAYERS_READY }
		} );

		const aggregatedMockData = buildAggregatedGameData( {
			...mockGame,
			players: [ ...mockGame.players, mockPlayer1 ]
		} );

		expect( mockGame.status ).toEqual( GameStatus.PLAYERS_READY );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( new GameUpdateEvent( aggregatedMockData, mockAuthInfo ) );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );