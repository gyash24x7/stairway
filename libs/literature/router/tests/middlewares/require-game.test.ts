import { Db, db, ILiteratureGame, LiteratureGame } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IUser } from "@s2h/utils";
import { LiteratureTrpcContext } from "@s2h/literature/router";
import { requireGame } from "../../src/middlewares";
import { Messages } from "../../src/constants";
import { DeepMockProxy, mockClear, mockDeep } from "vitest-mock-extended";
import { RSingleSelection, RTable } from "rethinkdb-ts";
import { LoremIpsum } from "lorem-ipsum";
import console from "node:console";
import { createId } from "@paralleldrive/cuid2";

vi.mock( "@s2h/literature/utils", async ( importOriginal ) => {
	const originalImport = await importOriginal<any>();
	const { mockDeep } = await import("vitest-mock-extended");
	return { ...originalImport, db: mockDeep<Db>() };
} );

const lorem = new LoremIpsum();

describe( "Require Game Middleware", () => {

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

	const mockedDb = db as DeepMockProxy<Db>;
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const mockRSingleSelection = mockDeep<RSingleSelection<ILiteratureGame | null>>();

	beforeEach( () => {
		mockRSingleSelection.run.calledWith( mockCtx.connection ).mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );
	} );

	it( "should throw error when gameId not present in raw input", () => {
		const rawInput = { gameId: undefined };
		const middleware = requireGame();

		expect.assertions( 2 );
		return middleware( { ctx: mockCtx, rawInput, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_GAME_ID );
			} );
	} );

	it( "should throw error when game not present with that gameId", () => {
		const rawInput = { gameId: createId() };
		mockRSingleSelection.run.calledWith( mockCtx.connection ).mockResolvedValue( null );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const middleware = requireGame();

		expect.assertions( 4 );
		return middleware( { ctx: mockCtx, rawInput, next: mockNextFn } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "NOT_FOUND" );
				expect( e.message ).toBe( Messages.GAME_NOT_FOUND );
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( rawInput.gameId );
				expect( mockedDb.literature ).toHaveBeenCalled();
			} );
	} );

	it( "should call next with game in context", () => {
		const rawInput = { gameId: mockGame.id };
		const middleware = requireGame();

		middleware( { ctx: mockCtx, rawInput, next: mockNextFn } )
			.then( () => {
				expect( mockNextFn.mock.calls.length ).toBe( 1 );
				expect( mockNextFn.mock.calls[ 0 ][ 0 ] ).toEqual( { ctx: mockCtx } );
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( rawInput.gameId );
				expect( mockedDb.literature ).toHaveBeenCalled();
			} )
			.catch( err => {
				console.log( err );
			} );
	} );

	afterEach( () => {
		mockClear( mockedDb );
		mockClear( mockLiteratureTable );
		mockClear( mockCtx );
		mockClear( mockRSingleSelection );
		mockClear( mockNextFn );
	} );

} );