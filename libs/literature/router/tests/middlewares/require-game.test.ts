import { EnhancedLitGame } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import cuid from "cuid";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { Messages } from "../../src/constants";
import { requireGameMiddlewareFn } from "../../src/middlewares/require-game";
import type { LitTrpcContext } from "../../src/types";
import { createMockContext, LitMockContext, MockLitGameData } from "../utils";

describe( "Require Game Middleware", function () {

	let mockCtx: LitMockContext;
	let ctx: LitTrpcContext;
	let mockNextFn: Mock;
	let mockGame: MockLitGameData;

	beforeEach( function () {
		mockCtx = createMockContext();
		ctx = mockCtx as unknown as LitTrpcContext;
		mockNextFn = vi.fn();
		mockGame = new MockLitGameData();
	} );

	it( "should throw error when gameId not present in raw input", function () {
		const rawInput = { gameId: undefined };

		return requireGameMiddlewareFn( { ctx, rawInput, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_GAME_ID );
			} );
	} );

	it( "should throw error when gameId is not a proper cuid", function () {
		const rawInput = { gameId: "randomId" };

		return requireGameMiddlewareFn( { ctx, rawInput, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_GAME_ID );
			} );
	} );

	it( "should throw error when game not present with that gameId", function () {
		const rawInput = { gameId: cuid() };
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( null );

		return requireGameMiddlewareFn( { ctx, rawInput, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "NOT_FOUND" );
				expect( e.message ).toBe( Messages.GAME_NOT_FOUND );
				expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
					expect.objectContaining( {
						where: expect.objectContaining( { id: rawInput.gameId } )
					} )
				);
			} );
	} );

	it( "should call next with game in context", function () {
		const rawInput = { gameId: mockGame.id };
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( mockGame );

		return requireGameMiddlewareFn( { ctx, rawInput, next: mockNextFn } )
			.then( () => {
				ctx.currentGame = EnhancedLitGame.from( mockGame );

				expect( mockNextFn.mock.calls.length ).toBe( 1 );
				expect( mockNextFn.mock.calls[ 0 ][ 0 ] ).toEqual( { ctx } );
				expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
					expect.objectContaining( {
						where: expect.objectContaining( { id: rawInput.gameId } )
					} )
				);
			} );
	} );

} );