import type { LitPlayer, User } from "@prisma/client";
import { EnhancedLitGame } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { Messages } from "../../src/constants";
import { requirePlayerMiddlewareFn } from "../../src/middlewares/require-player";
import type { LitTrpcContext } from "../../src/types";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";

describe( "Require Player Middleware", function () {

	let mockCtx: LitMockContext;
	let ctx: LitTrpcContext;
	let mockNextFn: Mock;
	let mockLoggedInUser: User;
	let player1: LitPlayer;
	let gameData: MockLitGameData;

	beforeEach( function () {
		gameData = new MockLitGameData();
		player1 = gameData.generatePlayer();
		mockLoggedInUser = createMockUser( player1.userId, player1.name );
		mockCtx = createMockContext( mockLoggedInUser );
		ctx = mockCtx as unknown as LitTrpcContext;
		mockNextFn = vi.fn();
	} );

	it( "should throw error when userId not present", function () {
		mockCtx = createMockContext();
		ctx = mockCtx as unknown as LitTrpcContext;

		expect.assertions( 2 );
		return requirePlayerMiddlewareFn( { ctx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "UNAUTHORIZED" );
				expect( e.message ).toBe( Messages.USER_NOT_LOGGED_IN );
			} );
	} );

	it( "should throw error when game not present", function () {
		expect.assertions( 2 );
		return requirePlayerMiddlewareFn( { ctx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "NOT_FOUND" );
				expect( e.message ).toBe( Messages.GAME_NOT_FOUND );
			} );
	} );

	it( "should throw error when user not part of game", function () {
		gameData = new MockLitGameData();
		ctx.currentGame = EnhancedLitGame.from( gameData );

		expect.assertions( 2 );
		return requirePlayerMiddlewareFn( { ctx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "FORBIDDEN" );
				expect( e.message ).toBe( Messages.NOT_PART_OF_GAME );
			} );
	} );

	it( "should call next function with loggedInPlayer in currentGame", function () {
		ctx.currentGame = EnhancedLitGame.from( gameData );

		expect.assertions( 2 );
		return requirePlayerMiddlewareFn( { ctx, rawInput: {}, next: mockNextFn } )
			.then( () => {
				ctx.currentGame!.loggedInUserId = gameData.players[ 0 ].userId;

				expect( mockNextFn.mock.calls.length ).toBe( 1 );
				expect( mockNextFn.mock.calls[ 0 ][ 0 ] ).toEqual( { ctx } );
			} );
	} );

} );