import { LiteratureGame, LiteraturePlayer } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Messages } from "../../src/constants";
import { requireTurn } from "../../src/middlewares";
import type { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { mockDeep } from "vitest-mock-extended";
import { LitTrpcContext } from "@s2h/literature/router";
import { LoremIpsum } from "lorem-ipsum";

const lorem = new LoremIpsum();

describe( "Require Turn Middleware", () => {

	const mockUser: IUser = {
		id: createId(),
		name: lorem.generateWords( 2 ),
		avatar: "",
		salt: lorem.generateWords( 1 ),
		email: ""
	};

	const mockCtx = mockDeep<LitTrpcContext>();
	const mockNextFn = vi.fn();
	const mockGame = LiteratureGame.create( 2, mockUser );
	mockGame.addPlayers( LiteraturePlayer.create( mockUser ) );

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
		mockCtx.currentGame = mockGame;
	} );

	it( "should throw error when user not present", () => {
		mockCtx.loggedInUser = undefined;
		const middleware = requireTurn();

		expect.assertions( 2 );
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "UNAUTHORIZED" );
				expect( e.message ).toBe( Messages.USER_NOT_LOGGED_IN );
			} );
	} );

	it( "should throw error when game not present", () => {
		mockCtx.currentGame = undefined;
		const middleware = requireTurn();

		expect.assertions( 2 );
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "NOT_FOUND" );
				expect( e.message ).toBe( Messages.GAME_NOT_FOUND );
			} );
	} );

	it( "should throw error when it is not logged in user's turn", () => {
		mockGame.currentTurn = createId();
		mockCtx.currentGame = mockGame;
		const middleware = requireTurn();

		expect.assertions( 2 );
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "FORBIDDEN" );
				expect( e.message ).toBe( Messages.OUT_OF_TURN );
			} );
	} );

	it( "should call next when it is logged in user's turn", () => {
		mockGame.currentTurn = mockUser.id;
		mockCtx.currentGame = mockGame;
		const middleware = requireTurn();
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.then( () => {
				expect( mockNextFn ).toHaveBeenCalledWith( { ctx: mockCtx } );
			} );
	} );

} );