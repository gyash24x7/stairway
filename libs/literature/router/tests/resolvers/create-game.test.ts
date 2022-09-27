import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";
import { literatureRouter } from "@s2h/literature/router";
import type { InferMutationInput, LitTrpcContext } from "../../src/types";
import type { LitPlayer, User } from "@prisma/client";

describe( "Create Game Mutation", function () {

    let gameData: MockLitGameData;
    let player: LitPlayer;
    let mockLoggedInUser: User;
    let mockCtx: LitMockContext;
    let caller: ReturnType<typeof literatureRouter.createCaller>;

    beforeEach( function () {
        gameData = new MockLitGameData();
        player = gameData.generatePlayer();
        mockLoggedInUser = createMockUser( player.userId, player.name );
        mockCtx = createMockContext( mockLoggedInUser );
        mockCtx.prisma.litGame.create.mockResolvedValue( gameData );
        mockCtx.prisma.litPlayer.create.mockResolvedValue( player );

        caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );
    } );

    it( "should create new game with provided player count", async function () {
        gameData.playerCount = 6;
        mockCtx.prisma.litGame.create.mockResolvedValue( gameData );
        const input: InferMutationInput<"create-game"> = { playerCount: 6 };
        const game = await caller.mutation( "create-game", input );

        expect( game.id ).toBe( gameData.id );
        expect( game.playerCount ).toBe( 6 );
        expect( mockCtx.prisma.litGame.create ).toHaveBeenCalledWith(
            expect.objectContaining( {
                data: expect.objectContaining( {
                    createdById: mockLoggedInUser.id,
                    playerCount: 6
                } )
            } )
        );

        expect( mockCtx.prisma.litPlayer.create ).toHaveBeenCalledWith(
            expect.objectContaining( {
                data: expect.objectContaining( {
                    name: player.name,
                    avatar: player.avatar,
                    hand: { cards: [] }
                } )
            } )
        );
    } );

    it( "should create new game with 2 player count when not provided", async function () {
        const input: InferMutationInput<"create-game"> = {};
        const game = await caller.mutation( "create-game", input );

        expect( game.id ).toBe( gameData.id );
        expect( game.playerCount ).toBe( 2 );
        expect( mockCtx.prisma.litGame.create ).toHaveBeenCalledWith(
            expect.objectContaining( {
                data: expect.objectContaining( {
                    createdById: mockLoggedInUser.id,
                    playerCount: undefined
                } )
            } )
        );

        expect( mockCtx.prisma.litPlayer.create ).toHaveBeenCalledWith(
            expect.objectContaining( {
                data: expect.objectContaining( {
                    name: player.name,
                    avatar: player.avatar,
                    hand: { cards: [] }
                } )
            } )
        )
    } );
} );