import { literatureRouter } from "@s2h/literature/router";
import type { InferQueryInput, LitTrpcContext } from "../../src/types";
import { createMockContext, createMockUser, MockLitGameData } from "../utils";

describe( "Get Game Query", function () {

    it( "should return enhanced game", async function () {
        const gameData = new MockLitGameData();
        const player = gameData.generatePlayer();
        const mockLoggedInUser = createMockUser( player.userId, player.name );
        const mockCtx = createMockContext( mockLoggedInUser );
        const caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );
        mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );

        const input: InferQueryInput<"get-game"> = { gameId: gameData.id };
        const game = await caller.query( "get-game", input );

        expect( game.id ).toBe( gameData.id );
        expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: gameData.id } )
            } )
        );
    } );
} );