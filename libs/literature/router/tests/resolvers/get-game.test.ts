import { literatureRouter as router } from "@s2h/literature/router";
import { inferProcedureInput } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { createMockContext, createMockUser, MockLitGameData } from "../utils";

describe( "Get Game Query", function () {

	it( "should return enhanced game", async function () {
		const gameData = new MockLitGameData();
		const player = gameData.generatePlayer();
		const mockLoggedInUser = createMockUser( player.userId, player.name );
		const mockCtx = createMockContext( mockLoggedInUser );
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );

		const input: inferProcedureInput<typeof router["getGame"]> = { gameId: gameData.id };
		const game = await router.createCaller( mockCtx ).getGame( input );

		expect( game.id ).toBe( gameData.id );
		expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: gameData.id } )
			} )
		);
	} );
} );