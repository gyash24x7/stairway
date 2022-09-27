import { literatureRouter } from "@s2h/literature/router";
import type { InferMutationInput, LitTrpcContext } from "../../src/types";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";
import { LitGameStatus, LitPlayer, LitTeam, User } from "@prisma/client";
import type { TRPCError } from "@trpc/server";
import { Messages } from "../../src/constants";

describe( "Create Teams Mutation", function () {

    let gameData: MockLitGameData;
    let player1: LitPlayer;
    let player2: LitPlayer;
    let team1: LitTeam;
    let team2: LitTeam;
    let mockLoggedInUser: User;
    let mockCtx: LitMockContext;
    let caller: ReturnType<typeof literatureRouter.createCaller>;
    let input: InferMutationInput<"create-teams">;

    beforeEach( function () {
        gameData = new MockLitGameData( { status: LitGameStatus.PLAYERS_READY } );
        player1 = gameData.generatePlayer();
        [ team1, team2 ] = gameData.generateTeams( { addToList: false } );
        mockLoggedInUser = createMockUser( player1.userId, player1.name );
        mockCtx = createMockContext( mockLoggedInUser );
        mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );

        input = { gameId: gameData.id, teams: [ team1.name, team2.name ] };
        caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );
    } );

    it( "should throw error if game status not PLAYERS_READY", function () {
        gameData.status = LitGameStatus.NOT_STARTED;

        expect.assertions( 2 );
        return caller.mutation( "create-teams", input )
            .catch( ( e: TRPCError ) => {
                expect( e.code ).toBe( "BAD_REQUEST" );
                expect( e.message ).toBe( Messages.INVALID_GAME_STATUS );
            } )
    } );

    it( "should throw error if number of players not equal to playerCount", function () {
        expect.assertions( 2 );
        return caller.mutation( "create-teams", input )
            .catch( ( e: TRPCError ) => {
                expect( e.code ).toBe( "BAD_REQUEST" );
                expect( e.message ).toBe( Messages.NOT_ENOUGH_PLAYERS );
            } )
    } );

    it( "should create 2 teams and return updated game", async function () {
        player2 = gameData.generatePlayer();
        mockCtx.prisma.litGame.update.mockResolvedValue( gameData );
        mockCtx.prisma.litTeam.create.mockResolvedValueOnce( team1 ).mockResolvedValueOnce( team2 );
        mockCtx.prisma.litPlayer.update.mockResolvedValue( player1 ).mockResolvedValue( player2 );

        const game = await caller.mutation( "create-teams", input );

        expect( game.id ).toBe( gameData.id );
        expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: gameData.id } )
            } )
        );

        expect( mockCtx.prisma.litGame.update ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: gameData.id } ),
                data: expect.objectContaining( { status: LitGameStatus.TEAMS_CREATED } )
            } )
        );

        expect( mockCtx.prisma.litTeam.create ).toHaveBeenCalledTimes( 2 );
        expect( mockCtx.prisma.litTeam.create ).toHaveBeenCalledWith(
            expect.objectContaining( {
                data: expect.objectContaining( {
                    name: team1.name,
                    gameId: gameData.id
                } )
            } )
        );

        expect( mockCtx.prisma.litTeam.create ).toHaveBeenCalledWith(
            expect.objectContaining( {
                data: expect.objectContaining( {
                    name: team2.name,
                    gameId: gameData.id
                } )
            } )
        );

        expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledTimes( 2 );
        expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: player1.id } ),
                data: expect.objectContaining( { teamId: expect.any( String ) } )
            } )
        );

        expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { id: player2.id } ),
                data: expect.objectContaining( { teamId: expect.any( String ) } )
            } )
        );

        expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
            expect.objectContaining( {
                id: gameData.id,
                status: LitGameStatus.TEAMS_CREATED
            } )
        );
    } );
} );