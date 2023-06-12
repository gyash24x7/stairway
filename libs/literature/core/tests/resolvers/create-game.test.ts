import { literatureRouter as router, LiteratureTrpcContext } from "@s2h/literature/router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { ILiteratureGame } from "@s2h/literature/utils";
import { RDatum, RTable, WriteResult } from "rethinkdb-ts";
import { LoremIpsum } from "lorem-ipsum";

const lorem = new LoremIpsum();

describe( "Create Game Mutation", () => {

	const mockUser: IUser = {
		id: createId(),
		name: lorem.generateWords( 2 ),
		avatar: "",
		salt: lorem.generateWords( 1 ),
		email: ""
	};

	const mockCtx = mockDeep<LiteratureTrpcContext>();
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const writeResultMock = mockDeep<RDatum<WriteResult<ILiteratureGame>>>();

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
		writeResultMock.run.mockResolvedValue( mockDeep() );
		mockLiteratureTable.insert.mockReturnValue( writeResultMock );
		mockCtx.db.games.mockReturnValue( mockLiteratureTable );
	} );

	it( "should create new game with provided player count", async () => {
		const game = await router.createCaller( mockCtx ).createGame( { playerCount: 6 } );

		expect( game.playerCount ).toBe( 6 );
		expect( mockCtx.db.games ).toHaveBeenCalled();
		expect( mockLiteratureTable.insert ).toHaveBeenCalledWith( game );
		expect( writeResultMock.run ).toHaveBeenCalledWith( mockCtx.connection );
	} );

	it( "should create new game with 2 player count when not provided", async () => {
		const game = await router.createCaller( mockCtx ).createGame( {} );

		expect( game.playerCount ).toBe( 2 );
		expect( mockCtx.db.games ).toHaveBeenCalled();
		expect( mockLiteratureTable.insert ).toHaveBeenCalledWith( game );
		expect( writeResultMock.run ).toHaveBeenCalledWith( mockCtx.connection );
	} );

	afterEach( () => {
		mockClear( writeResultMock );
		mockClear( mockLiteratureTable );
		mockClear( mockCtx );
	} );
} );