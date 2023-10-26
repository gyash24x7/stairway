import { afterEach, describe, expect, it } from "vitest";
import type { CreateGameInput, Game } from "@literature/types";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import { CreateGameCommand, CreateGameCommandHandler } from "../../src/commands";
import { mockAuthInfo, mockPlayer1 } from "../mockdata";

describe( "CreateGameCommand", () => {

	const mockInput: CreateGameInput = {
		playerCount: 4
	};

	const mockPrisma = mockDeep<PrismaService>();
	const mockGame = mockDeep<Game>();
	mockGame.id = "game123";

	it( "should create a new game and add the logged in player", async () => {
		mockPrisma.literature.game.create.mockResolvedValue( mockGame );
		mockPrisma.literature.player.create.mockResolvedValue( mockDeep() );

		const createGameCommandHandler = new CreateGameCommandHandler( mockPrisma );
		await createGameCommandHandler.execute( new CreateGameCommand( mockInput, mockAuthInfo ) );

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
	} );
} );