import { literatureRouter as router, LiteratureTrpcContext } from "@s2h/literature/router";
import { Db, db, ILiteratureGame, LiteratureGame, LiteratureGameStatus, LiteraturePlayer } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Messages } from "../../src/constants";
import { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { DeepMockProxy, mockClear, mockDeep } from "vitest-mock-extended";
import { RDatum, RSingleSelection, RTable, WriteResult } from "rethinkdb-ts";
import { LoremIpsum } from "lorem-ipsum";

vi.mock( "@s2h/literature/utils", async ( importOriginal ) => {
	const originalImport = await importOriginal<any>();
	const { mockDeep } = await import("vitest-mock-extended");
	return { ...originalImport, db: mockDeep<Db>() };
} );

const lorem = new LoremIpsum();

describe( "Start Game Mutation", () => {

	const mockUser: IUser = {
		id: createId(),
		name: lorem.generateWords( 2 ),
		avatar: "",
		salt: lorem.generateWords( 1 ),
		email: ""
	};

	const mockCtx = mockDeep<LiteratureTrpcContext>();
	const mockWriteResult = mockDeep<RDatum<WriteResult<ILiteratureGame | null>>>();
	const mockRSingleSelection = mockDeep<RSingleSelection<ILiteratureGame | null>>();
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const mockedDb = db as DeepMockProxy<Db>;

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
		mockWriteResult.run.mockResolvedValue( mockDeep() );
		mockRSingleSelection.update.mockReturnValue( mockWriteResult );
	} );

	it( "should throw error if game status not TEAMS_CREATED", () => {
		const mockGame = LiteratureGame.create( 2, mockUser );
		mockGame.addPlayers( LiteraturePlayer.create( mockUser ) );
		mockGame.status = LiteratureGameStatus.PLAYERS_READY;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).startGame( { gameId: mockGame.id } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_GAME_STATUS );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should deal cards and return updated game", async () => {
		const mockGame = LiteratureGame.create( 2, mockUser );

		const mockPlayer1 = LiteraturePlayer.create( mockUser );
		mockGame.addPlayers( mockPlayer1 );

		const mockPlayer2 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
		mockGame.addPlayers( mockPlayer2 );

		mockGame.status = LiteratureGameStatus.TEAMS_CREATED;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const game = await router.createCaller( mockCtx ).startGame( { gameId: mockGame.id } );

		expect( game.id ).toBe( mockGame.id );
		expect( game.status ).toBe( LiteratureGameStatus.IN_PROGRESS );
		expect( game.currentTurn ).toEqual( mockUser.id );

		expect( mockedDb.literature ).toHaveBeenCalledTimes( 2 );
		expect( mockLiteratureTable.get ).toHaveBeenCalledTimes( 2 );
		expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
		expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
		expect( mockWriteResult.run ).toHaveBeenCalledWith( mockCtx.connection );
		expect( mockRSingleSelection.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				status: LiteratureGameStatus.IN_PROGRESS,
				id: mockGame.id
			} )
		);
	} );

	afterEach( () => {
		mockClear( mockedDb );
		mockClear( mockLiteratureTable );
		mockClear( mockRSingleSelection );
		mockClear( mockWriteResult );
		mockClear( mockCtx );
	} );
} );