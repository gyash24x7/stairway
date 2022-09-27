import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";
import { LitGameStatus, LitMove, LitMoveType, LitPlayer, User } from "@prisma/client";
import type { InferMutationInput, LitTrpcContext } from "../../src/types";
import { literatureRouter } from "@s2h/literature/router";
import type { TRPCError } from "@trpc/server";
import { Messages } from "../../src/constants";

describe( "Transfer Turn Mutation", function () {

    let gameData: MockLitGameData;
    let player1: LitPlayer;
    let player2: LitPlayer;
    let player3: LitPlayer;
    let player4: LitPlayer;
    let mockCtx: LitMockContext;
    let mockLoggedInUser: User;
    let input: InferMutationInput<"transfer-turn">;
    let caller: ReturnType<typeof literatureRouter.createCaller>;
    let transferTurnMove: LitMove;

    beforeEach( function () {
        gameData = new MockLitGameData( { playerCount: 4 } );
        gameData.generatePlayer();
        gameData.generatePlayer();
        gameData.generatePlayer();
        gameData.generatePlayer();
        gameData.generateTeams();
        [ player1, player2, player3, player4 ] = gameData.dealCards();

        mockLoggedInUser = createMockUser( player1.userId, player1.name );
        mockCtx = createMockContext( mockLoggedInUser );
        mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );

        input = { gameId: gameData.id };
        caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );
    } );

    it( "should throw error if player has cards", async function () {
        expect.assertions( 3 );
        return caller.mutation( "transfer-turn", input )
            .catch( ( e: TRPCError ) => {
                expect( e.code ).toBe( "BAD_REQUEST" );
                expect( e.message ).toBe( Messages.INVALID_TRANSFER );

                expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
                    expect.objectContaining( {
                        where: expect.objectContaining( { id: gameData.id } )
                    } )
                );
            } );
    } );

    it( "should complete the game if none of the players have cards", async function () {
        player1.hand = { cards: [] };
        player2.hand = { cards: [] };
        player3.hand = { cards: [] };
        player4.hand = { cards: [] };
        gameData.players = [ player1, player2, player3, player4 ];
        mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
        mockCtx.prisma.litGame.update.mockResolvedValue( { ...gameData, status: LitGameStatus.COMPLETED } );
        caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );

        const game = await caller.mutation( "transfer-turn", input );
        expect( game.status ).toBe( LitGameStatus.COMPLETED );

        expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: gameData.id } )
            } )
        );

        expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
            expect.objectContaining( {
                id: gameData.id,
                status: LitGameStatus.COMPLETED
            } )
        );
    } );

    it( "should transfer chance to team member of same team if they have cards", async function () {
        player1.hand = { cards: [] };
        gameData.players = [ player1, player2, player3, player4 ];
        transferTurnMove = gameData.generateMove( LitMoveType.TURN, { turnPlayer: player2 }, false );
        mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
        mockCtx.prisma.litMove.create.mockResolvedValue( transferTurnMove );
        caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );

        const game = await caller.mutation( "transfer-turn", input );
        expect( game.id ).toBe( gameData.id );
        expect( player1.teamId ).toBe( player2.teamId );

        expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: gameData.id } )
            } )
        );

        expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
            expect.objectContaining( { id: gameData.id } )
        );

        expect( mockCtx.prisma.litMove.create ).toHaveBeenCalledWith(
            expect.objectContaining( {
                data: expect.objectContaining( { turnId: player2.id } )
            } )
        );
    } );

    it( "should transfer chance to opposite team if same team doesn't have cards", async function () {
        player1.hand = { cards: [] };
        player2.hand = { cards: [] };
        player3.hand = { cards: [] };
        gameData.players = [ player1, player2, player3, player4 ];
        transferTurnMove = gameData.generateMove( LitMoveType.TURN, { turnPlayer: player4 }, false );
        mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
        mockCtx.prisma.litMove.create.mockResolvedValue( transferTurnMove );
        caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );

        const game = await caller.mutation( "transfer-turn", input );
        expect( game.id ).toBe( gameData.id );
        expect( player1.teamId === player4.teamId ).toBeFalsy();

        expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: gameData.id } )
            } )
        );

        expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
            expect.objectContaining( { id: gameData.id } )
        );

        expect( mockCtx.prisma.litMove.create ).toHaveBeenCalledWith(
            expect.objectContaining( {
                data: expect.objectContaining( { turnId: player4.id } )
            } )
        );
    } );

} );