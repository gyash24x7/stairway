import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";
import { DeepMockProxy, mockClear, mockDeep } from "vitest-mock-extended";
import { literatureRouter as router, LitTrpcContext } from "@s2h/literature/router";
import { RDatum, RSingleSelection, RTable, WriteResult } from "rethinkdb-ts";
import {
	Db,
	db,
	ILiteratureGame,
	LiteratureGame,
	LiteratureGameStatus,
	LiteratureMove,
	LiteratureMoveActionData,
	LiteratureMoveResultData,
	LiteraturePlayer
} from "@s2h/literature/utils";
import { LoremIpsum } from "lorem-ipsum";
import { CardSet, cardSetMap } from "@s2h/cards";
import { Messages } from "../../src/constants";
import { ChanceTransferInput } from "@s2h/literature/dtos";

vi.mock( "@s2h/literature/utils", async ( importOriginal ) => {
	const originalImport = await importOriginal<any>();
	const { mockDeep } = await import( "vitest-mock-extended" );
	return { ...originalImport, db: mockDeep<Db>() };
} );

const lorem = new LoremIpsum();

describe( "Chance Transfer Mutation", () => {

	const mockUser: IUser = {
		id: createId(),
		name: lorem.generateWords( 2 ),
		avatar: "",
		salt: lorem.generateWords( 1 ),
		email: ""
	};

	const team1 = lorem.generateWords( 2 );
	const team2 = lorem.generateWords( 2 );

	const mockPlayer1 = LiteraturePlayer.create( mockUser );
	mockPlayer1.team = team1;
	const mockPlayer2 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
	mockPlayer2.team = team1;
	const mockPlayer3 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
	mockPlayer3.team = team2;
	const mockPlayer4 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
	mockPlayer4.team = team2;

	const mockCtx = mockDeep<LitTrpcContext>();
	const mockWriteResult = mockDeep<RDatum<WriteResult<ILiteratureGame | null>>>();
	const mockRSingleSelection = mockDeep<RSingleSelection<ILiteratureGame | null>>();
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const mockedDb = db as DeepMockProxy<Db>;

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
		mockWriteResult.run.mockResolvedValue( mockDeep() );
		mockRSingleSelection.update.mockReturnValue( mockWriteResult );
	} );

	it( "should throw error if previous move is not a successful call", async () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;

		const actionData: LiteratureMoveActionData = {
			description: "",
			action: "CALL_SET",
			callData: {
				playerId: mockPlayer1.id,
				set: CardSet.SMALL_HEARTS,
				data: { [ mockPlayer1.id ]: cardSetMap[ CardSet.SMALL_HEARTS ] }
			}
		};

		const resultData: LiteratureMoveResultData = { description: "", result: "CALL_SET", success: false };
		mockGame.moves = [ LiteratureMove.create( actionData, resultData ) ];
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: ChanceTransferInput = { transferTo: mockPlayer2.id, gameId: mockGame.id };

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).chanceTransfer( input )
			.catch( e => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_CHANCE_TRANSFER );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should throw error if previous move is not a call", async () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;

		const actionData: LiteratureMoveActionData = {
			description: "",
			action: "CHANCE_TRANSFER",
			transferData: { playerId: mockPlayer1.id }
		};

		const resultData: LiteratureMoveResultData = { description: "", result: "CHANCE_TRANSFER", success: false };
		mockGame.moves = [ LiteratureMove.create( actionData, resultData ) ];
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: ChanceTransferInput = { transferTo: mockPlayer2.id, gameId: mockGame.id };

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).chanceTransfer( input )
			.catch( e => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_CHANCE_TRANSFER );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );


	it( "should throw error if chance receiving player not part of game", async () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;

		const actionData: LiteratureMoveActionData = {
			description: "",
			action: "CALL_SET",
			callData: {
				playerId: mockPlayer1.id,
				set: CardSet.SMALL_HEARTS,
				data: { [ mockPlayer1.id ]: cardSetMap[ CardSet.SMALL_HEARTS ] }
			}
		};

		const resultData: LiteratureMoveResultData = { description: "", result: "CALL_SET", success: true };
		mockGame.moves = [ LiteratureMove.create( actionData, resultData ) ];
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: ChanceTransferInput = { transferTo: createId(), gameId: mockGame.id };

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).chanceTransfer( input )
			.catch( e => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.PLAYER_NOT_FOUND );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );


	it( "should throw error if chance receiving player has no cards", async () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.hands[ mockPlayer2.id ].cards = [];
		mockGame.players[ mockPlayer2.id ].hand.cards = [];
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;

		const actionData: LiteratureMoveActionData = {
			description: "",
			action: "CALL_SET",
			callData: {
				playerId: mockPlayer1.id,
				set: CardSet.SMALL_HEARTS,
				data: { [ mockPlayer1.id ]: cardSetMap[ CardSet.SMALL_HEARTS ] }
			}
		};

		const resultData: LiteratureMoveResultData = { description: "", result: "CALL_SET", success: true };
		mockGame.moves = [ LiteratureMove.create( actionData, resultData ) ];
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: ChanceTransferInput = { transferTo: mockPlayer2.id, gameId: mockGame.id };

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).chanceTransfer( input )
			.catch( e => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CHANCE_TRANSFER_TO_PLAYER_WITH_CARDS );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );


	it( "should throw error if chance receiving player not part of same team", async () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;

		const actionData: LiteratureMoveActionData = {
			description: "",
			action: "CALL_SET",
			callData: {
				playerId: mockPlayer1.id,
				set: CardSet.SMALL_HEARTS,
				data: { [ mockPlayer1.id ]: cardSetMap[ CardSet.SMALL_HEARTS ] }
			}
		};

		const resultData: LiteratureMoveResultData = { description: "", result: "CALL_SET", success: true };
		mockGame.moves = [ LiteratureMove.create( actionData, resultData ) ];
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: ChanceTransferInput = { transferTo: mockPlayer3.id, gameId: mockGame.id };

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).chanceTransfer( input )
			.catch( e => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CHANCE_TRANSFER_TO_SAME_TEAM_PLAYER );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );


	it( "should transfer chance to mentioned player", async () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;

		const actionData: LiteratureMoveActionData = {
			description: "",
			action: "CALL_SET",
			callData: {
				playerId: mockPlayer1.id,
				set: CardSet.SMALL_HEARTS,
				data: { [ mockPlayer1.id ]: cardSetMap[ CardSet.SMALL_HEARTS ] }
			}
		};

		const resultData: LiteratureMoveResultData = { description: "", result: "CALL_SET", success: true };
		mockGame.moves = [ LiteratureMove.create( actionData, resultData ) ];
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: ChanceTransferInput = { transferTo: mockPlayer2.id, gameId: mockGame.id };
		const response = await router.createCaller( mockCtx ).chanceTransfer( input );
		const game = LiteratureGame.from( response );

		expect( game.id ).toBe( mockGame.id );
		expect( game.currentTurn ).toBe( mockPlayer2.id );

		const lastMove = game.moves[ 0 ];
		expect( lastMove.actionData.action ).toBe( "CHANCE_TRANSFER" );
		expect( lastMove.resultData.result ).toBe( "CHANCE_TRANSFER" );
		expect( lastMove.resultData.success ).toBe( true );

		expect( mockedDb.literature ).toHaveBeenCalledTimes( 2 );
		expect( mockLiteratureTable.get ).toHaveBeenCalledTimes( 2 );
		expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
		expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
		expect( mockWriteResult.run ).toHaveBeenCalledWith( mockCtx.connection );
		expect( mockRSingleSelection.update ).toHaveBeenCalledWith(
			expect.objectContaining( { id: mockGame.id } )
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