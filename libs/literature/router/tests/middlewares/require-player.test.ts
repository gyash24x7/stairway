import { ILiteratureGame, LiteratureGame, LiteraturePlayer } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Messages } from "../../src/constants";
import { requirePlayer } from "../../src/middlewares";
import type { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { mockDeep } from "vitest-mock-extended";
import { LiteratureTrpcContext } from "@s2h/literature/router";
import { RSingleSelection, RTable } from "rethinkdb-ts";
import { LoremIpsum } from "lorem-ipsum";

const lorem = new LoremIpsum();

describe( "Require Player Middleware", () => {

	const mockUser: IUser = {
		id: createId(),
		name: lorem.generateWords( 2 ),
		avatar: "",
		salt: lorem.generateWords( 1 ),
		email: ""
	};

	const mockCtx = mockDeep<LiteratureTrpcContext>();
	const mockNextFn = vi.fn();
	const mockGame = LiteratureGame.create( 2, mockUser );
	mockGame.addPlayers( LiteraturePlayer.create( mockUser ) );
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const mockRSingleSelection = mockDeep<RSingleSelection<ILiteratureGame | null>>();

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
		mockCtx.currentGame = mockGame;
		mockRSingleSelection.run.calledWith( mockCtx.connection ).mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );
	} );

	it( "should throw error when user not present", () => {
		mockCtx.loggedInUser = undefined;
		const middleware = requirePlayer();

		expect.assertions( 2 );
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "UNAUTHORIZED" );
				expect( e.message ).toBe( Messages.USER_NOT_LOGGED_IN );
			} );
	} );

	it( "should throw error when game not present", () => {
		mockCtx.currentGame = undefined;
		const middleware = requirePlayer();

		expect.assertions( 2 );
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "NOT_FOUND" );
				expect( e.message ).toBe( Messages.GAME_NOT_FOUND );
			} );
	} );

	it( "should throw error when user not part of game", () => {
		mockCtx.currentGame = LiteratureGame.create( 2, { ...mockUser, id: createId() } );
		const middleware = requirePlayer();

		expect.assertions( 2 );
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "FORBIDDEN" );
				expect( e.message ).toBe( Messages.NOT_PART_OF_GAME );
			} );
	} );

	it( "should call next function with loggedInPlayer in currentGame", () => {
		const middleware = requirePlayer();

		expect.assertions( 2 );
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.then( () => {
				expect( mockNextFn.mock.calls.length ).toBe( 1 );
				expect( mockNextFn.mock.calls[ 0 ][ 0 ] ).toEqual( { ctx: mockCtx } );
			} );
	} );

} );