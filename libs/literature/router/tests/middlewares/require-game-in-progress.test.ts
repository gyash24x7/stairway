import { ILiteratureGame, LiteratureGame, LiteratureGameStatus } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Messages } from "../../src/constants";
import { requireGameInProgress } from "../../src/middlewares";
import type { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { RSingleSelection, RTable } from "rethinkdb-ts";
import { LoremIpsum } from "lorem-ipsum";
import { LiteratureTrpcContext } from "@s2h/literature/router";

const lorem = new LoremIpsum();

describe( "Require Game in Progress Middleware", () => {

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
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const mockRSingleSelection = mockDeep<RSingleSelection<ILiteratureGame | null>>();

	beforeEach( () => {
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;
		mockRSingleSelection.run.calledWith( mockCtx.connection ).mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );
	} );

	it( "should throw error when game not present", () => {
		mockCtx.currentGame = undefined;
		const middleware = requireGameInProgress();

		expect.assertions( 2 );
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "NOT_FOUND" );
				expect( e.message ).toBe( Messages.GAME_NOT_FOUND );
			} );
	} );

	it( "should throw error when game not in progress", () => {
		mockGame.status = LiteratureGameStatus.CREATED;
		mockCtx.currentGame = mockGame;

		expect.assertions( 2 );
		const middleware = requireGameInProgress();
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_GAME_STATUS );
			} );
	} );

	it( "should call next function when game is in progress", () => {
		const middleware = requireGameInProgress();
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.then( () => {
				expect( mockNextFn ).toHaveBeenCalledWith( { ctx: mockCtx } );
			} );
	} );

	afterEach( () => {
		mockClear( mockCtx );
		mockClear( mockNextFn );
		mockClear( mockRSingleSelection );
		mockClear( mockLiteratureTable );
	} );

} );