import { createId } from "@paralleldrive/cuid2";
import { CardHand, CardRank, CardSet, CardSuit, IPlayingCard, PlayingCard } from "@s2h/cards";
import { literatureRouter as router, LiteratureTrpcContext } from "@s2h/literature/router";
import { ILiteratureGame, LiteratureGame, LiteratureGameStatus, LiteraturePlayer } from "@s2h/literature/utils";
import type { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Messages } from "../../src/constants";
import { IUser } from "@s2h/utils";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { RDatum, RSingleSelection, RTable, WriteResult } from "rethinkdb-ts";
import { LoremIpsum } from "lorem-ipsum";

const lorem = new LoremIpsum();

describe( "Ask Card Mutation", () => {

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

	beforeEach( () => {
		mockCtx.loggedInUser = mockUser;
		mockWriteResult.run.mockResolvedValue( mockDeep() );
		mockRSingleSelection.update.mockReturnValue( mockWriteResult );
	} );

	it( "should throw error if asking from same team", () => {
		const mockGame = LiteratureGame.create( 2, mockUser );

		const mockPlayer1 = LiteraturePlayer.create( mockUser );
		mockGame.addPlayers( mockPlayer1 );

		const mockPlayer2 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
		mockGame.addPlayers( mockPlayer2 );

		const askedCard: IPlayingCard = { rank: CardRank.TWO, suit: CardSuit.SPADES };

		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockGame.dealCards();
		mockGame.createTeams( [
			{ name: lorem.generateWords( 2 ), members: [ mockPlayer1.id ] },
			{ name: lorem.generateWords( 2 ), members: [ mockPlayer2.id ] }
		] );
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );

		expect.assertions( 5 );
		return router.createCaller( mockCtx )
			.askCard( { gameId: mockGame.id, askedFor: askedCard, askedFrom: mockPlayer1.id } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CANNOT_ASK_FROM_YOUR_TEAM );
				expect( mockCtx.db.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should throw error if player asking from not part of game", () => {
		const mockGame = LiteratureGame.create( 2, mockUser );

		const mockPlayer1 = LiteraturePlayer.create( mockUser );
		mockGame.addPlayers( mockPlayer1 );

		const mockPlayer2 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
		mockGame.addPlayers( mockPlayer2 );

		const askedCard: IPlayingCard = { rank: CardRank.TWO, suit: CardSuit.SPADES };

		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockGame.dealCards();
		mockGame.createTeams( [
			{ name: lorem.generateWords( 2 ), members: [ mockPlayer1.id ] },
			{ name: lorem.generateWords( 2 ), members: [ mockPlayer2.id ] }
		] );
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );

		expect.assertions( 5 );
		return router.createCaller( mockCtx )
			.askCard( { gameId: mockGame.id, askedFor: askedCard, askedFrom: createId() } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.PLAYER_NOT_FOUND );
				expect( mockCtx.db.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should throw error if logged in player already has that card", () => {
		const mockGame = LiteratureGame.create( 2, mockUser );

		const mockPlayer1 = LiteraturePlayer.create( mockUser );
		mockGame.addPlayers( mockPlayer1 );

		const mockPlayer2 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
		mockGame.addPlayers( mockPlayer2 );

		const twoOfSpades: IPlayingCard = { rank: CardRank.TWO, suit: CardSuit.SPADES };

		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockGame.createTeams( [
			{ name: lorem.generateWords( 2 ), members: [ mockPlayer1.id ] },
			{ name: lorem.generateWords( 2 ), members: [ mockPlayer2.id ] }
		] );
		mockGame.dealCards();
		mockGame.removeCardsOfSet( CardSet.SMALL_SPADES );
		mockGame.addCardsToPlayer( mockPlayer1.id, PlayingCard.from( twoOfSpades ) );
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );

		expect.assertions( 5 );
		return router.createCaller( mockCtx )
			.askCard( { gameId: mockGame.id, askedFor: twoOfSpades, askedFrom: mockPlayer2.id } )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CANNOT_ASK_CARD_THAT_YOU_HAVE );
				expect( mockCtx.db.literature ).toHaveBeenCalled();
				expect( mockLiteratureTable.get ).toHaveBeenCalledWith( mockGame.id );
				expect( mockRSingleSelection.run ).toHaveBeenCalledWith( mockCtx.connection );
			} );
	} );

	it( "should execute ask move and transfer card", async () => {
		const mockGame = LiteratureGame.create( 2, mockUser );

		const mockPlayer1 = LiteraturePlayer.create( mockUser );
		mockGame.addPlayers( mockPlayer1 );

		const mockPlayer2 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
		mockGame.addPlayers( mockPlayer2 );

		const twoOfSpades = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.SPADES } );
		const fourOfSpades = PlayingCard.from( { rank: CardRank.FOUR, suit: CardSuit.SPADES } );

		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockGame.createTeams( [
			{ name: lorem.generateWords( 2 ), members: [ mockPlayer1.id ] },
			{ name: lorem.generateWords( 2 ), members: [ mockPlayer2.id ] }
		] );
		mockGame.dealCards();
		mockGame.removeCardsOfSet( CardSet.SMALL_SPADES );
		mockGame.addCardsToPlayer( mockPlayer2.id, twoOfSpades );
		mockGame.addCardsToPlayer( mockPlayer1.id, fourOfSpades );
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );

		const game = await router.createCaller( mockCtx ).askCard( {
			gameId: mockGame.id,
			askedFor: twoOfSpades,
			askedFrom: mockPlayer2.id
		} );

		const { actionData, resultData } = game.moves[ 0 ];

		expect( game.id ).toBe( mockGame.id );
		expect( actionData.action ).toEqual( "ASK" );
		expect( resultData.success ).toBeTruthy();
		expect( resultData.result ).toEqual( "CARD_TRANSFER" );
		expect( CardHand.from( game.players[ mockPlayer2.id ].hand ).contains( twoOfSpades ) ).toBeFalsy();
		expect( CardHand.from( game.players[ mockPlayer1.id ].hand ).contains( twoOfSpades ) ).toBeTruthy();

		expect( mockCtx.db.literature ).toHaveBeenCalledTimes( 2 );
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

	it( "should execute ask move and not transfer card", async () => {
		const mockGame = LiteratureGame.create( 2, mockUser );

		const mockPlayer1 = LiteraturePlayer.create( mockUser );
		mockGame.addPlayers( mockPlayer1 );

		const mockPlayer2 = LiteraturePlayer.create( { ...mockUser, id: createId() } );
		mockGame.addPlayers( mockPlayer2 );

		const twoOfSpades = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.SPADES } );
		const fourOfSpades = PlayingCard.from( { rank: CardRank.FOUR, suit: CardSuit.SPADES } );
		const fiveOfSpades = PlayingCard.from( { rank: CardRank.FIVE, suit: CardSuit.SPADES } );

		mockGame.status = LiteratureGameStatus.IN_PROGRESS;
		mockGame.createTeams( [
			{ name: lorem.generateWords( 2 ), members: [ mockPlayer1.id ] },
			{ name: lorem.generateWords( 2 ), members: [ mockPlayer2.id ] }
		] );
		mockGame.dealCards();
		mockGame.removeCardsOfSet( CardSet.SMALL_SPADES );
		mockGame.addCardsToPlayer( mockPlayer2.id, twoOfSpades );
		mockGame.addCardsToPlayer( mockPlayer1.id, fourOfSpades );
		mockCtx.currentGame = mockGame;

		mockRSingleSelection.run.mockResolvedValue( mockGame );
		mockLiteratureTable.get.mockReturnValue( mockRSingleSelection );
		mockCtx.db.literature.mockReturnValue( mockLiteratureTable );

		const game = await router.createCaller( mockCtx ).askCard( {
			gameId: mockGame.id,
			askedFor: fiveOfSpades,
			askedFrom: mockPlayer2.id
		} );

		const { actionData, resultData } = game.moves[ 0 ];

		expect( game.id ).toBe( mockGame.id );
		expect( actionData.action ).toEqual( "ASK" );
		expect( resultData.success ).toBeFalsy();
		expect( resultData.result ).toEqual( "CARD_TRANSFER" );
		expect( CardHand.from( game.players[ mockPlayer2.id ].hand ).contains( fiveOfSpades ) ).toBeFalsy();
		expect( CardHand.from( game.players[ mockPlayer1.id ].hand ).contains( fiveOfSpades ) ).toBeFalsy();

		expect( mockCtx.db.literature ).toHaveBeenCalledTimes( 2 );
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
		mockClear( mockLiteratureTable );
		mockClear( mockRSingleSelection );
		mockClear( mockWriteResult );
		mockClear( mockCtx );
	} );
} );