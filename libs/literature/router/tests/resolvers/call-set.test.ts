import { createId, createId as cuid } from "@paralleldrive/cuid2";
import { CardRank, CardSet, cardSetMap, CardSuit } from "@s2h/cards";
import { literatureRouter as router, LiteratureTrpcContext } from "@s2h/literature/router";
import { Db, db, ILiteratureGame, LiteratureGame, LiteratureGameStatus, LiteraturePlayer } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Messages } from "../../src/constants";
import { IUser, logger } from "@s2h/utils";
import { DeepMockProxy, mockClear, mockDeep } from "vitest-mock-extended";
import { RDatum, RSingleSelection, RTable, WriteResult } from "rethinkdb-ts";
import { LoremIpsum } from "lorem-ipsum";
import { CallSetInput } from "@s2h/literature/dtos";

vi.mock( "@s2h/literature/utils", async ( importOriginal ) => {
	const originalImport = await importOriginal<any>();
	const { mockDeep } = await import("vitest-mock-extended");
	return { ...originalImport, db: mockDeep<Db>() };
} );

const lorem = new LoremIpsum();

describe( "Call Set Mutation", () => {

	const mockUser: IUser = {
		id: createId(),
		name: lorem.generateWords( 2 ),
		avatar: "",
		salt: lorem.generateWords( 1 ),
		email: ""
	};

	const team1 = lorem.generateWords( 2 );
	const team2 = lorem.generateWords( 2 );

	const mockCtx = mockDeep<LiteratureTrpcContext>();
	const mockWriteResult = mockDeep<RDatum<WriteResult<ILiteratureGame | null>>>();
	const mockRSingleSelection = mockDeep<RSingleSelection<ILiteratureGame | null>>();
	const mockLiteratureTable = mockDeep<RTable<ILiteratureGame>>();
	const mockedDb = db as DeepMockProxy<Db>;

	const mockPlayer1 = LiteraturePlayer.create( mockUser );
	mockPlayer1.team = team1;
	const mockPlayer2 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
	mockPlayer2.team = team1;
	const mockPlayer3 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
	mockPlayer3.team = team2;
	const mockPlayer4 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
	mockPlayer4.team = team2;

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
		mockWriteResult.run.mockResolvedValue( mockDeep() );
		mockRSingleSelection.update.mockReturnValue( mockWriteResult );
	} );

	it( "should throw error if any called player not part of game", () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: CallSetInput = {
			gameId: mockGame.id,
			data: {
				[ cuid() ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
				[ mockPlayer1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.SPADES } ]
			}
		};

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).callSet( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.PLAYER_NOT_FOUND );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should throw error if user's cards not called out", () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: CallSetInput = {
			gameId: mockGame.id,
			data: {
				[ mockPlayer2.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ]
			}
		};

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).callSet( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_CALL );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should throw error if duplicate cards are called", () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: CallSetInput = {
			gameId: mockGame.id,
			data: {
				[ mockPlayer1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
				[ mockPlayer2.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ]
			}
		};

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).callSet( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.DUPLICATES_IN_CALL );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should throw error if more than one set called", () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: CallSetInput = {
			gameId: mockGame.id,
			data: {
				[ mockPlayer1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
				[ mockPlayer2.id ]: [ { rank: CardRank.TWO, suit: CardSuit.SPADES } ]
			}
		};

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).callSet( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CALL_CARDS_OF_SAME_SET );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should throw error if user doesn't have cards of calling set", () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.removeCardsOfSet( CardSet.SMALL_HEARTS );
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: CallSetInput = {
			gameId: mockGame.id,
			data: {
				[ mockPlayer1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
				[ mockPlayer2.id ]: [ { rank: CardRank.ACE, suit: CardSuit.HEARTS } ],
				[ mockPlayer3.id ]: [ { rank: CardRank.THREE, suit: CardSuit.HEARTS } ],
				[ mockPlayer4.id ]: [ { rank: CardRank.FOUR, suit: CardSuit.HEARTS } ]
			}
		};

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).callSet( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CANNOT_CALL_SET_THAT_YOU_DONT_HAVE );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should throw error if cards called outside the team", () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.removeCardsOfSet( CardSet.SMALL_HEARTS );
		mockGame.addCardsToPlayer( mockPlayer1.id, ...cardSetMap[ CardSet.SMALL_HEARTS ] );
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: CallSetInput = {
			gameId: mockGame.id,
			data: {
				[ mockPlayer1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
				[ mockPlayer4.id ]: [
					{ rank: CardRank.THREE, suit: CardSuit.HEARTS },
					{ rank: CardRank.FIVE, suit: CardSuit.HEARTS },
					{ rank: CardRank.FOUR, suit: CardSuit.HEARTS },
					{ rank: CardRank.SIX, suit: CardSuit.HEARTS },
					{ rank: CardRank.ACE, suit: CardSuit.HEARTS }
				]
			}
		};

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).callSet( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CALL_WITHIN_YOUR_TEAM );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should throw error if 6 cards not called", () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();
		mockGame.removeCardsOfSet( CardSet.SMALL_HEARTS );
		mockGame.addCardsToPlayer( mockPlayer1.id, ...cardSetMap[ CardSet.SMALL_HEARTS ] );
		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: CallSetInput = {
			gameId: mockGame.id,
			data: {
				[ mockPlayer1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ]
			}
		};

		expect.assertions( 5 );
		return router.createCaller( mockCtx ).callSet( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CALL_ALL_CARDS );
				expect( mockedDb.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should increase score for team if called correct", async () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();

		const smallHearts = cardSetMap[ CardSet.SMALL_HEARTS ];
		mockGame.removeCardsOfSet( CardSet.SMALL_HEARTS );
		mockGame.addCardsToPlayer( mockPlayer1.id, ...smallHearts.slice( 0, 3 ) );
		mockGame.addCardsToPlayer( mockPlayer2.id, ...smallHearts.slice( 3 ) );

		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );


		const input: CallSetInput = {
			gameId: mockGame.id,
			data: {
				[ mockPlayer1.id ]: smallHearts.slice( 0, 3 ),
				[ mockPlayer2.id ]: smallHearts.slice( 3 )
			}
		};

		const response = await router.createCaller( mockCtx ).callSet( input );
		const game = LiteratureGame.from( response );

		expect( game.id ).toBe( mockGame.id );
		expect( game.players[ mockPlayer1.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( game.players[ mockPlayer2.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( game.players[ mockPlayer3.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( game.players[ mockPlayer4.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		logger.debug( "Game: %o", game.serialize() );
		expect( game.teams[ mockPlayer1.team! ].score ).toBe( 1 );
	} );

	it( "should increase score for other team if called wrong", async () => {
		const mockGame = LiteratureGame.create( 4, mockUser );
		mockGame.addPlayers( mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 );
		mockGame.createTeams( [
			{ name: team1, members: [ mockPlayer1.id, mockPlayer2.id ] },
			{ name: team2, members: [ mockPlayer3.id, mockPlayer4.id ] }
		] );
		mockGame.dealCards();

		const smallHearts = cardSetMap[ CardSet.SMALL_HEARTS ];
		mockGame.removeCardsOfSet( CardSet.SMALL_HEARTS );
		mockGame.addCardsToPlayer( mockPlayer1.id, ...smallHearts.slice( 0, 3 ) );
		mockGame.addCardsToPlayer( mockPlayer2.id, ...smallHearts.slice( 3 ) );

		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockedDb.literature.mockReturnValue( mockLiteratureTable );

		const input: CallSetInput = {
			gameId: mockGame.id,
			data: {
				[ mockPlayer1.id ]: [ smallHearts[ 2 ], smallHearts[ 1 ], smallHearts[ 4 ] ],
				[ mockPlayer2.id ]: [ smallHearts[ 0 ], smallHearts[ 3 ], smallHearts[ 5 ] ]
			}
		};

		const response = await router.createCaller( mockCtx ).callSet( input );
		const game = LiteratureGame.from( response );

		expect( game.id ).toBe( mockGame.id );
		expect( game.players[ mockPlayer1.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( game.players[ mockPlayer2.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( game.players[ mockPlayer3.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( game.players[ mockPlayer4.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( game.teams[ mockPlayer3.team! ].score ).toBe( 1 );
	} );

	afterEach( () => {
		mockClear( mockedDb );
		mockClear( mockLiteratureTable );
		mockClear( mockRSingleSelection );
		mockClear( mockWriteResult );
		mockClear( mockCtx );
	} );

} );