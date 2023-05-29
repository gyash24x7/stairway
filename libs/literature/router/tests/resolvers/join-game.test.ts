import { literatureRouter as router, LiteratureTrpcContext } from "@s2h/literature/router";
import { ILiteratureGame, LiteratureGame, LiteratureGameStatus, LiteraturePlayer } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Messages } from "../../src/constants";
import { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { RDatum, RSingleSelection, RTable, WriteResult } from "rethinkdb-ts";
import { LoremIpsum } from "lorem-ipsum";

const lorem = new LoremIpsum();

describe( "Join Game Mutation", () => {

	const mockUser: IUser = {
		id: createId(),
		name: lorem.generateWords( 2 ),
		avatar: "",
		salt: lorem.generateWords( 1 ),
		email: ""
	};

	const mockCtx = mockDeep<LiteratureTrpcContext>();
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const mockRSingleSelection = mockDeep<RSingleSelection<ILiteratureGame | null>>();
	const mockWriteResult = mockDeep<RDatum<WriteResult<ILiteratureGame | null>>>();

	let mockGame: LiteratureGame;

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
		mockGame = LiteratureGame.create( 2, mockUser );
	} );

	it( "should throw error when game not found", async () => {
		mockLiteratureTable.run.mockResolvedValue( [] );
		mockLiteratureTable.filter.mockReturnValue( mockLiteratureTable );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).joinGame( { code: mockGame.code } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "NOT_FOUND" );
				expect( e.message ).toBe( Messages.GAME_NOT_FOUND );
				expect( mockCtx.db.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.filter ).toHaveBeenCalledWith( { code: mockGame.code } );
				expect( mockLiteratureTable.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should return the game if user already part of game", async () => {
		const mockPlayer = LiteraturePlayer.create( mockUser );
		mockGame.addPlayers( mockPlayer );

		mockLiteratureTable.run.mockResolvedValue( [ mockGame ] );
		mockLiteratureTable.filter.mockReturnValue( mockLiteratureTable );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );

		const game = await router.createCaller( mockCtx ).joinGame( { code: mockGame.code } );

		expect( game.id ).toBe( mockGame.id );
		expect( Object.keys( game.players ).length ).toBe( Object.keys( mockGame.players ).length );

		expect( mockCtx.db.literature ).toHaveBeenCalled();
		expect( mockLiteratureTable.filter ).toHaveBeenCalledWith( { code: mockGame.code } );
		expect( mockLiteratureTable.run ).toHaveBeenCalledWith( mockCtx.connection );
	} );

	it( "should throw error if player capacity is full", async () => {
		const mockPlayer1 = LiteraturePlayer.create( mockUser );
		mockGame.addPlayers( mockPlayer1 );

		const mockPlayer2 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
		mockGame.addPlayers( mockPlayer2 );

		mockLiteratureTable.run.mockResolvedValue( [ mockGame ] );
		mockLiteratureTable.filter.mockReturnValue( mockLiteratureTable );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).joinGame( { code: mockGame.code } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.PLAYER_CAPACITY_FULL );
				expect( mockCtx.db.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.filter ).toHaveBeenCalledWith( { code: mockGame.code } );
				expect( mockLiteratureTable.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should add user to the game, keep status to CREATED when player capacity not reached", async () => {
		mockGame.players = {};
		mockWriteResult.run.mockResolvedValue( mockDeep() );
		mockRSingleSelection.update.mockReturnValue( mockWriteResult );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockLiteratureTable.run.mockResolvedValue( [ mockGame ] );
		mockLiteratureTable.filter.mockReturnValue( mockLiteratureTable );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );

		const game = await router.createCaller( mockCtx ).joinGame( { code: mockGame.code } );

		expect( game.id ).toBe( mockGame.id );
		expect( Object.keys( game.players ).length ).toBe( Object.keys( mockGame.players ).length + 1 );
		expect( game.status ).toBe( LiteratureGameStatus.CREATED );

		expect( mockCtx.db.literature ).toHaveBeenCalledTimes( 2 );
		expect( mockLiteratureTable.filter ).toHaveBeenCalledWith( { code: mockGame.code } );
		expect( mockLiteratureTable.run ).toHaveBeenCalledWith( mockCtx.connection );
		expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
		expect( mockWriteResult.run ).toHaveBeenCalledWith( mockCtx.connection );
		expect( mockRSingleSelection.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: mockGame.id,
				status: LiteratureGameStatus.CREATED
			} )
		);
	} );

	it( "should add user to the game, update status to PLAYERS_READY when player capacity reached", async () => {
		mockGame.players = {};
		const mockPlayer = LiteraturePlayer.create( { ...mockUser, id: createId() } );
		mockGame.addPlayers( mockPlayer );

		mockWriteResult.run.mockResolvedValue( mockDeep() );
		mockRSingleSelection.update.mockReturnValue( mockWriteResult );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockLiteratureTable.run.mockResolvedValue( [ mockGame ] );
		mockLiteratureTable.filter.mockReturnValue( mockLiteratureTable );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );

		const game = await router.createCaller( mockCtx ).joinGame( { code: mockGame.code } );

		expect( game.id ).toBe( mockGame.id );
		expect( Object.keys( game.players ).length ).toBe( Object.keys( mockGame.players ).length + 1 );
		expect( game.status ).toBe( LiteratureGameStatus.PLAYERS_READY );

		expect( mockCtx.db.literature ).toHaveBeenCalled();
		expect( mockLiteratureTable.filter ).toHaveBeenCalledWith( { code: mockGame.code } );
		expect( mockLiteratureTable.run ).toHaveBeenCalledWith( mockCtx.connection );
		expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
		expect( mockWriteResult.run ).toHaveBeenCalledWith( mockCtx.connection );
		expect( mockRSingleSelection.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: mockGame.id,
				status: LiteratureGameStatus.PLAYERS_READY
			} )
		);
	} );

	afterEach( () => {
		mockClear( mockWriteResult );
		mockClear( mockRSingleSelection );
		mockClear( mockLiteratureTable );
		mockClear( mockCtx );
	} );
} );