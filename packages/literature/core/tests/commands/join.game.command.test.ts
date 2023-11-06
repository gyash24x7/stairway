import type { JoinGameInput } from "@literature/types";
import { GameStatus } from "@literature/types";
import type { EventBus } from "@nestjs/cqrs";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { JoinGameCommand, JoinGameCommandHandler } from "../../src/commands";
import { PlayerJoinedEvent } from "../../src/events";
import type { JoinGameValidator } from "../../src/validators";
import { buildMockRawGameData, mockAuthInfo, mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 } from "../mockdata";

describe( "JoinGameCommand", () => {

	const mockInput: JoinGameInput = { code: "BCDEDIT" };
	const mockGame = buildMockRawGameData( GameStatus.CREATED );

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();
	const mockValidator = mockDeep<JoinGameValidator>();

	it( "should return game if user already part of game", async () => {
		mockValidator.validate.mockResolvedValue( { game: mockGame, isUserAlreadyInGame: true } );

		const commandHandler = new JoinGameCommandHandler( mockPrisma, mockValidator, mockEventBus );
		const gameWithPlayers = await commandHandler.execute( new JoinGameCommand( mockInput, mockAuthInfo ) );

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
		const gameWithPlayers = await commandHandler.execute( new JoinGameCommand( mockInput, mockAuthInfo ) );

		expect( mockPrisma.literature.player.create ).toHaveBeenCalledWith( {
			data: {
				id: mockAuthInfo.id,
				name: mockAuthInfo.name,
				avatar: mockAuthInfo.avatar,
				gameId: mockGame.id
			}
		} );

		expect( gameWithPlayers.players ).toEqual( [ mockPlayer2, mockPlayer4, mockPlayer3, mockPlayer1 ] );

		const event = new PlayerJoinedEvent( mockGame.id, mockPlayer1, false );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );