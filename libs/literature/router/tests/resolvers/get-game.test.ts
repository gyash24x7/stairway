import { literatureRouter as router, LitTrpcContext } from "@s2h/literature/router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { DeepMockProxy, mockClear, mockDeep } from "vitest-mock-extended";
import { RSingleSelection, RTable } from "rethinkdb-ts";
import { Db, db, ILiteratureGame, LiteratureGame, LiteraturePlayer } from "@s2h/literature/utils";
import { LoremIpsum } from "lorem-ipsum";

vi.mock( "@s2h/literature/utils", async ( importOriginal ) => {
	const originalImport = await importOriginal<any>();
	const { mockDeep } = await import("vitest-mock-extended");
	return { ...originalImport, db: mockDeep<Db>() };
} );

const lorem = new LoremIpsum();

describe( "Get Game Query", () => {

	const mockUser: IUser = {
		id: createId(),
		name: lorem.generateWords( 2 ),
		avatar: "",
		salt: lorem.generateWords( 1 ),
		email: ""
	};

	const mockCtx = mockDeep<LitTrpcContext>();
	const mockRSingleSelection = mockDeep<RSingleSelection<ILiteratureGame | null>>();
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const mockedDb = db as DeepMockProxy<Db>;

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
	} );

	it( "should return the game for the given id", async () => {
		const mockGame = LiteratureGame.create( 2, mockUser );
		mockGame.addPlayers( LiteraturePlayer.create( mockUser ) );
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const game = await router.createCaller( mockCtx ).getGame( { gameId: mockGame.id } );

		expect( game.id ).toBe( mockGame.id );
		expect( mockedDb.literature ).toHaveBeenCalled();
		expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
		expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
	} );

	afterEach( () => {
		mockClear( mockedDb );
		mockClear( mockLiteratureTable );
		mockClear( mockRSingleSelection );
		mockClear( mockCtx );
	} );
} );