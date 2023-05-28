import { literatureRouter as router, LiteratureTrpcContext } from "@s2h/literature/router";
import { db, Db, ILiteratureGame, LiteratureGame, LiteratureGameStatus, LiteraturePlayer } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Messages } from "../../src/constants";
import { CreateTeamsInput } from "@s2h/literature/dtos";
import { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { LoremIpsum } from "lorem-ipsum";
import { DeepMockProxy, mockClear, mockDeep } from "vitest-mock-extended";
import { RDatum, RSingleSelection, RTable, WriteResult } from "rethinkdb-ts";

vi.mock( "@s2h/literature/utils", async ( importOriginal ) => {
	const originalImport = await importOriginal<any>();
	const { mockDeep } = await import("vitest-mock-extended");
	return { ...originalImport, db: mockDeep<Db>() };
} );

const lorem = new LoremIpsum();

describe( "Create Teams Mutation", () => {

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

	it( "should throw error if game status not PLAYERS_READY", () => {
		const mockGame = LiteratureGame.create( 2, mockUser );
		mockGame.addPlayers( LiteraturePlayer.create( mockUser ) );
		mockGame.status = LiteratureGameStatus.CREATED;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const team1 = { name: lorem.generateWords( 2 ), members: [] };
		const team2 = { name: lorem.generateWords( 2 ), members: [] };
		const input: CreateTeamsInput = { gameId: mockGame.id, teams: [ team1, team2 ] };

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).createTeams( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_GAME_STATUS );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should throw error if number of players not equal to playerCount", () => {
		const mockGame = LiteratureGame.create( 2, mockUser );
		const mockPlayer = LiteraturePlayer.create( mockUser );

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		mockGame.addPlayers( mockPlayer );
		mockGame.status = LiteratureGameStatus.PLAYERS_READY;
		mockCtx.currentGame = mockGame;

		const team1 = { name: lorem.generateWords( 2 ), members: [ mockPlayer.id ] };
		const team2 = { name: lorem.generateWords( 2 ), members: [] };
		const input: CreateTeamsInput = { gameId: mockGame.id, teams: [ team1, team2 ] };

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).createTeams( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.NOT_ENOUGH_PLAYERS );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should create 2 teams and return updated game", async () => {
		const mockGame = LiteratureGame.create( 2, mockUser );

		const mockPlayer1 = LiteraturePlayer.create( mockUser );
		mockGame.addPlayers( mockPlayer1 );

		const mockPlayer2 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
		mockGame.addPlayers( mockPlayer2 );

		mockGame.status = LiteratureGameStatus.PLAYERS_READY;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const team1 = { name: lorem.generateWords( 2 ), members: [ mockPlayer1.id ] };
		const team2 = { name: lorem.generateWords( 2 ), members: [ mockPlayer2.id ] };
		const input: CreateTeamsInput = { gameId: mockGame.id, teams: [ team1, team2 ] };

		const game = await router.createCaller( mockCtx ).createTeams( input );

		expect( game.id ).toBe( mockGame.id );
		expect( Object.keys( game.teams ).length ).toBe( 2 );
		expect( game.teams[ team1.name ].members ).toContain( mockPlayer1.id );
		expect( game.teams[ team2.name ].members ).toContain( mockPlayer2.id );
		expect( game.players[ mockPlayer1.id ].team ).toEqual( team1.name );
		expect( game.players[ mockPlayer2.id ].team ).toEqual( team2.name );

		expect( mockedDb.literature ).toHaveBeenCalledTimes( 2 );
		expect( mockLiteratureTable.get ).toHaveBeenCalledTimes( 2 );
		expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
		expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
		expect( mockWriteResult.run ).toHaveBeenCalledWith( mockCtx.connection );
		expect( mockRSingleSelection.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				status: LiteratureGameStatus.TEAMS_CREATED,
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