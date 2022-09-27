import { literatureRouter } from "@s2h/literature/router";
import type { InferMutationInput, LitTrpcContext } from "../../src/types";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";
import { LitGameStatus, LitMove, LitMoveType, LitPlayer, User } from "@prisma/client";
import type { TRPCError } from "@trpc/server";
import { Messages } from "../../src/constants";
import type { IPlayingCard } from "@s2h/cards";

describe( "Start Game Mutation", function () {

    let gameData: MockLitGameData;
    let player1: LitPlayer;
    let player2: LitPlayer;
    let mockLoggedInUser: User;
    let mockCtx: LitMockContext;
    let caller: ReturnType<typeof literatureRouter.createCaller>;
    let input: InferMutationInput<"start-game">;
    let firstMove: LitMove;

    beforeEach( function () {
        gameData = new MockLitGameData( { status: LitGameStatus.TEAMS_CREATED } );
        player1 = gameData.generatePlayer();
        player2 = gameData.generatePlayer();
        mockLoggedInUser = createMockUser( player1.userId, player1.name );
        mockCtx = createMockContext( mockLoggedInUser );

        firstMove = gameData.generateMove( LitMoveType.TURN, { turnPlayer: player1 }, false );

        mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
        mockCtx.prisma.litPlayer.update.mockResolvedValueOnce( player1 ).mockResolvedValueOnce( player2 );
        mockCtx.prisma.litMove.create.mockResolvedValue( firstMove );
        mockCtx.prisma.litGame.update.mockResolvedValue( { ...gameData, moves: [ firstMove ] } as any );

        input = { gameId: gameData.id };
        caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );
    } );

    it( "should throw error if game status not TEAMS_CREATED", function () {
        gameData.status = LitGameStatus.PLAYERS_READY;
        mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
        caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );

        expect.assertions( 2 );
        return caller.mutation( "start-game", input )
            .catch( ( e: TRPCError ) => {
                expect( e.code ).toBe( "BAD_REQUEST" );
                expect( e.message ).toBe( Messages.INVALID_GAME_STATUS );
            } )
    } );

    it( "should deal cards and return updated game", async function () {
        const game = await caller.mutation( "start-game", input );

        expect( game.id ).toBe( gameData.id );
        expect( game.moves ).toEqual( [ firstMove ] );

        expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: gameData.id } )
            } )
        );

        expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledTimes( 2 );
        expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: player1.id } ),
                data: expect.objectContaining( {
                    hand: expect.objectContaining( {
                        cards: expect.any( Array<IPlayingCard> )
                    } )
                } )
            } )
        );

        expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: player2.id } ),
                data: expect.objectContaining( {
                    hand: expect.objectContaining( {
                        cards: expect.any( Array<IPlayingCard> )
                    } )
                } )
            } )
        );

        expect( mockCtx.prisma.litMove.create ).toHaveBeenCalledWith( {
            data: expect.objectContaining( {
                type: LitMoveType.TURN,
                turnId: player1.id,
                description: firstMove.description
            } )
        } );

        expect( mockCtx.prisma.litGame.update ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: gameData.id } ),
                data: expect.objectContaining( { status: LitGameStatus.IN_PROGRESS } )
            } )
        );

        expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
            expect.objectContaining( {
                id: gameData.id,
                status: LitGameStatus.IN_PROGRESS
            } )
        );
    } );
} );