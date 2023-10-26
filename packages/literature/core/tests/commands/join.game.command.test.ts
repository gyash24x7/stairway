import type { JoinGameInput } from "@literature/types";
import { GameStatus } from "@literature/types";
import type { HttpException } from "@nestjs/common";
import type { EventBus } from "@nestjs/cqrs";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { JoinGameCommand, JoinGameCommandHandler } from "../../src/commands";
import { Messages } from "../../src/constants";
import { PlayerJoinedEvent } from "../../src/events";
import { buildMockRawGameData, mockAuthInfo, mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 } from "../mockdata";

describe( "JoinGameCommand", () => {

	const mockInput: JoinGameInput = { code: "BCDEDIT" };
	const mockGame = buildMockRawGameData( GameStatus.CREATED );

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
			players: [ mockPlayer2, mockPlayer3, mockPlayer4, { ...mockPlayer1, id: "5" } ]
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

	it( "should return game if user already part of game", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( mockGame as any );

		const commandHandler = new JoinGameCommandHandler( mockPrisma, mockEventBus );
		const gameWithPlayers = await commandHandler.execute( new JoinGameCommand( mockInput, mockAuthInfo ) );

		expect( mockPrisma.literature.game.findUnique ).toHaveBeenCalledWith( {
			where: { code: mockInput.code },
			include: { players: true }
		} );

		expect( gameWithPlayers.players ).toEqual( [
			{ ...mockPlayer1, teamId: null },
			{ ...mockPlayer2, teamId: null },
			{ ...mockPlayer3, teamId: null },
			{ ...mockPlayer4, teamId: null }
		] );
	} );

	it( "should add user to the game and publish game update event", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( {
			...mockGame,
			playerCount: 6,
			players: [ mockPlayer2, mockPlayer4, mockPlayer3 ]
		} as any );
		mockPrisma.literature.player.create.mockResolvedValue( mockPlayer1 );

		const commandHandler = new JoinGameCommandHandler( mockPrisma, mockEventBus );
		const gameWithPlayers = await commandHandler.execute( new JoinGameCommand( mockInput, mockAuthInfo ) );

		expect( mockPrisma.literature.game.findUnique ).toHaveBeenCalledWith( {
			where: { code: mockInput.code },
			include: { players: true }
		} );

		expect( mockPrisma.literature.player.create ).toHaveBeenCalledWith( {
			data: {
				id: mockAuthInfo.id,
				name: mockAuthInfo.name,
				avatar: mockAuthInfo.avatar,
				gameId: mockGame.id,
				inferences: {}
			}
		} );

		expect( gameWithPlayers.players ).toEqual( [ mockPlayer2, mockPlayer4, mockPlayer3, mockPlayer1 ] );

		expect( mockEventBus.publish ).toHaveBeenCalledWith(
			new PlayerJoinedEvent( mockGame.id, mockPlayer1, false )
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );