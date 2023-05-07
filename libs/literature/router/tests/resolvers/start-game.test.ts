import { LitGameStatus, LitMove, LitMoveType, LitPlayer, User } from "@prisma/client";
import type { IPlayingCard } from "@s2h/cards";
import { literatureRouter as router } from "@s2h/literature/router";
import type { inferProcedureInput, TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { Messages } from "../../src/constants";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";

describe( "Start Game Mutation", function () {

	let gameData: MockLitGameData;
	let player1: LitPlayer;
	let player2: LitPlayer;
	let mockLoggedInUser: User;
	let mockCtx: LitMockContext;
	let input: inferProcedureInput<typeof router["startGame"]>;
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
	} );

	it( "should throw error if game status not TEAMS_CREATED", function () {
		gameData.status = LitGameStatus.PLAYERS_READY;
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );

		expect.assertions( 2 );
		return router.createCaller( mockCtx ).startGame( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_GAME_STATUS );
			} );
	} );

	it( "should deal cards and return updated game", async function () {
		const game = await router.createCaller( mockCtx ).startGame( input );

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