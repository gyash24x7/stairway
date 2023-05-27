import { literatureRouter as router, LitTrpcContext } from "@s2h/literature/router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";
import { Db, db, ILiteratureGame } from "@s2h/literature/utils";
import { RDatum, RTable, WriteResult } from "rethinkdb-ts";
import { LoremIpsum } from "lorem-ipsum";

vi.mock( "@s2h/literature/utils", async ( importOriginal ) => {
	const originalImport = await importOriginal<any>();
	const { mockDeep } = await import("vitest-mock-extended");
	return { ...originalImport, db: mockDeep<Db>() };
} );

const lorem = new LoremIpsum();

describe( "Create Game Mutation", () => {

	const mockUser: IUser = {
		id: createId(),
		name: lorem.generateWords( 2 ),
		avatar: "",
		salt: lorem.generateWords( 1 ),
		email: ""
	};

	const mockCtx = mockDeep<LitTrpcContext>();
	const mockedDb = db as DeepMockProxy<Db>;
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const writeResultMock = mockDeep<RDatum<WriteResult<ILiteratureGame>>>();

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
		writeResultMock.run.mockResolvedValue( mockDeep() );
		mockLiteratureTable.insert.mockReturnValue( writeResultMock );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );
	} );

	it( "should create new game with provided player count", async () => {
		const game = await router.createCaller( mockCtx ).createGame( { playerCount: 6 } );

		expect( game.playerCount ).toBe( 6 );
		expect( mockedDb.literature ).toHaveBeenCalled();
		expect( mockLiteratureTable.insert ).toHaveBeenCalledWith( game );
		expect( writeResultMock.run ).toHaveBeenCalledWith( mockCtx.connection );
	} );

	it( "should create new game with 2 player count when not provided", async () => {
		const game = await router.createCaller( mockCtx ).createGame( {} );

		expect( game.playerCount ).toBe( 2 );
		expect( mockedDb.literature ).toHaveBeenCalled();
		expect( mockLiteratureTable.insert ).toHaveBeenCalledWith( game );
		expect( writeResultMock.run ).toHaveBeenCalledWith( mockCtx.connection );
	} );
} );