import { LitGameStatus, LitPlayer, User } from "@prisma/client";
import { EnhancedLitGame } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { Messages } from "../../src/constants";
import { requireGameInProgressMiddlewareFn } from "../../src/middlewares/require-game-in-progress";
import type { LitTrpcContext } from "../../src/types";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";

describe( "Require Game in Progress Middleware", function () {

	let mockCtx: LitMockContext;
	let ctx: LitTrpcContext;
	let mockNextFn: Mock;
	let gameData: MockLitGameData;
	let mockLoggedInUser: User;
	let player1: LitPlayer;

	beforeEach( function () {
		gameData = new MockLitGameData();
		player1 = gameData.generatePlayer();
		mockLoggedInUser = createMockUser( player1.userId, player1.name );
		mockCtx = createMockContext( mockLoggedInUser );
		ctx = mockCtx as unknown as LitTrpcContext;
		mockNextFn = vi.fn();
	} );

	it( "should throw error when game not present", function () {
		expect.assertions( 2 );
		return requireGameInProgressMiddlewareFn( { ctx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "NOT_FOUND" );
				expect( e.message ).toBe( Messages.GAME_NOT_FOUND );
			} );
	} );

	it( "should throw error when game not in progress", function () {
		gameData.status = LitGameStatus.NOT_STARTED;
		ctx.currentGame = EnhancedLitGame.from( gameData );

		expect.assertions( 2 );
		return requireGameInProgressMiddlewareFn( { ctx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_GAME_STATUS );
			} );
	} );

	it( "should call next function when game is in progress", function () {
		ctx.currentGame = EnhancedLitGame.from( gameData );

		expect.assertions( 2 );
		return requireGameInProgressMiddlewareFn( { ctx, rawInput: {}, next: mockNextFn } )
			.then( () => {
				expect( mockNextFn.mock.calls.length ).toBe( 1 );
				expect( mockNextFn.mock.calls[ 0 ][ 0 ] ).toEqual( { ctx } );
			} );
	} );

} );