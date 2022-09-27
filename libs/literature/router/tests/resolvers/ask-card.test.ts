import { literatureRouter } from "@s2h/literature/router";
import type { InferMutationInput, LitTrpcContext } from "../../src/types";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";
import { LitGameStatus, LitMove, LitMoveType, LitPlayer, User } from "@prisma/client";
import type { TRPCError } from "@trpc/server";
import { Messages } from "../../src/constants";
import cuid from "cuid";
import { CardRank, CardSuit, PlayingCard } from "@s2h/cards";

describe( "Ask Card Mutation", function () {

    let gameData: MockLitGameData;
    let player1: LitPlayer;
    let player2: LitPlayer;
    let mockLoggedInUser: User;
    let mockCtx: LitMockContext;
    let caller: ReturnType<typeof literatureRouter.createCaller>;
    let input: InferMutationInput<"ask-card">;
    let askMove: LitMove;

    beforeEach( function () {
        gameData = new MockLitGameData( { status: LitGameStatus.IN_PROGRESS } );
        gameData.generatePlayer();
        gameData.generatePlayer();
        gameData.generateTeams();
        [ player1, player2 ] = gameData.dealCards( true );
        mockLoggedInUser = createMockUser( player1.userId, player1.name );
        mockCtx = createMockContext( mockLoggedInUser );

        input = {
            gameId: gameData.id,
            askedFor: { rank: CardRank.TWO, suit: CardSuit.SPADES },
            askedFrom: player2.id
        };

        askMove = gameData.generateMove(
            LitMoveType.ASK,
            { askedFor: PlayingCard.from( input.askedFor ), askedFrom: player2, askedBy: player1 },
            false
        );

        mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
        mockCtx.prisma.litMove.create.mockResolvedValue( askMove );

        caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );
    } );

    it( "should throw error if asking from same team", function () {
        input.askedFrom = player1.id;

        expect.assertions( 2 );
        return caller.mutation( "ask-card", input )
            .catch( ( e: TRPCError ) => {
                expect( e.code ).toBe( "BAD_REQUEST" );
                expect( e.message ).toBe( Messages.CANNOT_ASK_FROM_YOUR_TEAM );
            } )
    } );

    it( "should throw error if player asking from not part of game", function () {
        input.askedFrom = cuid();

        expect.assertions( 2 );
        return caller.mutation( "ask-card", input )
            .catch( ( e: TRPCError ) => {
                expect( e.code ).toBe( "BAD_REQUEST" );
                expect( e.message ).toBe( Messages.PLAYER_NOT_FOUND );
            } )
    } );

    it( "should throw error if logged in player already has that card", function () {
        input.askedFor = { rank: CardRank.TWO, suit: CardSuit.HEARTS };

        expect.assertions( 2 );
        return caller.mutation( "ask-card", input )
            .catch( ( e: TRPCError ) => {
                expect( e.code ).toBe( "BAD_REQUEST" );
                expect( e.message ).toBe( Messages.CANNOT_ASK_CARD_THAT_YOU_HAVE );
            } )
    } );

    it( "should create ask move and return updated game", async function () {
        const game = await caller.mutation( "ask-card", input );

        expect( game.id ).toBe( gameData.id );
        expect( game.moves ).toEqual( [ askMove ] );

        expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: gameData.id } )
            } )
        );

        expect( mockCtx.prisma.litMove.create ).toHaveBeenCalledWith( {
            data: expect.objectContaining( {
                type: LitMoveType.ASK,
                askedById: player1.id,
                askedFromId: player2.id,
                description: askMove.description
            } )
        } );

        expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
            expect.objectContaining( {
                id: gameData.id,
                status: LitGameStatus.IN_PROGRESS
            } )
        );
    } );
} );