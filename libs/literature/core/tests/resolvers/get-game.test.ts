import { literatureRouter as router, LiteratureTrpcContext } from "@s2h/literature/router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { RSingleSelection, RTable } from "rethinkdb-ts";
import { ILiteratureGame, LiteratureGame, LiteraturePlayer } from "@s2h/literature/utils";
import { LoremIpsum } from "lorem-ipsum";

const lorem = new LoremIpsum();

describe( "Get Game Query", () => {

	const mockUser: IUser = {
		id: createId(),
		name: lorem.generateWords( 2 ),
		avatar: "",
		salt: lorem.generateWords( 1 ),
		email: ""
	};

	const mockCtx = mockDeep<LiteratureTrpcContext>();
	const mockRSingleSelection = mockDeep<RSingleSelection<ILiteratureGame | null>>();
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
	} );

	it( "should return the game for the given id", async () => {
		const mockGame = LiteratureGame.create( 2, mockUser );
		mockGame.addPlayers( LiteraturePlayer.create( mockUser ) );
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockCtx.db.games.mockReturnValue( mockLiteratureTable );

		const game = await router.createCaller( mockCtx ).getGame( { gameId: mockGame.id } );

		expect( game.id ).toBe( mockGame.id );
		expect( mockCtx.db.games ).toHaveBeenCalled();
		expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
		expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
	} );

	afterEach( () => {
		mockClear( mockLiteratureTable );
		mockClear( mockRSingleSelection );
		mockClear( mockCtx );
	} );
} );