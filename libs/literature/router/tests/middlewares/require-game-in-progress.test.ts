import { Db, db, ILiteratureGame, LiteratureGame, LiteratureGameStatus } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Messages } from "../../src/constants";
import { requireGameInProgress } from "../../src/middlewares";
import type { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { DeepMockProxy, mockClear, mockDeep } from "vitest-mock-extended";
import { RSingleSelection, RTable } from "rethinkdb-ts";
import { LoremIpsum } from "lorem-ipsum";
import { LitTrpcContext } from "@s2h/literature/router";

vi.mock( "@s2h/literature/utils", async ( importOriginal ) => {
	const originalImport = await importOriginal<any>();
	const { mockDeep } = await import("vitest-mock-extended");
	return { ...originalImport, db: mockDeep<Db>() };
} );

const lorem = new LoremIpsum();

describe( "Require Game in Progress Middleware", () => {

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

	const mockedDb = db as DeepMockProxy<Db>;
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const mockRSingleSelection = mockDeep<RSingleSelection<ILiteratureGame | null>>();

	beforeEach( () => {
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;
		mockRSingleSelection.run.calledWith( mockCtx.connection ).mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );
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

		expect.assertions( 2 );
		return middleware( { ctx: mockCtx, rawInput: {}, next: mockNextFn } )
			.then( () => {
				expect( mockNextFn.mock.calls.length ).toBe( 1 );
				expect( mockNextFn.mock.calls[ 0 ][ 0 ] ).toEqual( { ctx: mockCtx } );
			} );
	} );

	afterEach( () => {
		mockClear( mockCtx );
		mockClear( mockedDb );
		mockClear( mockNextFn );
		mockClear( mockRSingleSelection );
		mockClear( mockLiteratureTable );
	} );

} );