import { LitGameStatus, LitMove, LitMoveType, LitPlayer, User } from "@prisma/client";
import { CardRank, CardSuit, IPlayingCard, PlayingCard } from "@s2h/cards";
import { literatureRouter as router } from "@s2h/literature/router";
import { EnhancedLitGame, EnhancedLitPlayer } from "@s2h/literature/utils";
import type { inferProcedureInput, TRPCError } from "@trpc/server";
import { createId as cuid } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { Messages } from "../../src/constants";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";

describe( "Give Card Mutation", function () {

	let gameData: MockLitGameData;
	let player1: LitPlayer;
	let player2: LitPlayer;
	let mockCtx: LitMockContext;
	let mockLoggedInUser: User;
	let input: inferProcedureInput<typeof router["giveCard"]>;
	let askMove: LitMove;
	let giveCardMove: LitMove;
	let cardToGive: PlayingCard;

	beforeEach( function () {
		gameData = new MockLitGameData();
		gameData.generatePlayer();
		gameData.generatePlayer();
		gameData.generateTeams();
		[ player1, player2 ] = gameData.dealCards();
		mockLoggedInUser = createMockUser( player1.userId, player1.name );
		mockCtx = createMockContext( mockLoggedInUser );

		input = {
			gameId: gameData.id,
			cardToGive: { rank: CardRank.TWO, suit: CardSuit.HEARTS },
			giveTo: player2.id
		};

		cardToGive = PlayingCard.from( input.cardToGive );

		askMove = gameData.generateMove(
			LitMoveType.ASK,
			{ askedFor: cardToGive, askedFrom: player1, askedBy: player2 }
		);

		giveCardMove = gameData.generateMove(
			LitMoveType.GIVEN,
			{ givingPlayer: player1, takingPlayer: player2, card: cardToGive },
			false
		);

		const player1Hand = EnhancedLitPlayer.from( player1 ).hand;
		player1Hand.removeCard( cardToGive );
		const player2Hand = EnhancedLitPlayer.from( player2 ).hand;
		player2Hand.addCard( cardToGive );

		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
		mockCtx.prisma.litPlayer.update
			.mockResolvedValueOnce( { ...player1, hand: player1Hand.serialize() } )
			.mockResolvedValueOnce( { ...player2, hand: player2Hand.serialize() } );
		mockCtx.prisma.litMove.create.mockResolvedValue( giveCardMove );
	} );

	it( "should throw error if taking player not part of game", function () {
		input.giveTo = cuid();

		expect.assertions( 2 );
		return router.createCaller( mockCtx ).giveCard( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.PLAYER_NOT_FOUND );
			} );
	} );

	it( "should throw error if card taking player part of same team", function () {
		input.giveTo = player1.id;

		expect.assertions( 2 );
		return router.createCaller( mockCtx ).giveCard( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CANNOT_GIVE_CARD_WITHIN_YOUR_TEAM );
			} );
	} );

	it( "should throw error if card giving player does not have that card", function () {
		input.cardToGive = { rank: CardRank.TWO, suit: CardSuit.SPADES };

		expect.assertions( 2 );
		return router.createCaller( mockCtx ).giveCard( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_GIVE_CARD );
			} );
	} );

	it( "should give card to the player and return updated game", async function () {
		const game = await router.createCaller( mockCtx ).giveCard( input );
		const enhancedGame = new EnhancedLitGame( game );

		expect( game.id ).toBe( gameData.id );
		expect( game.moves ).toEqual( [ giveCardMove, askMove ] );
		expect( enhancedGame.playerData[ player1.id ].hand.contains( cardToGive ) ).toBeFalsy();
		expect( enhancedGame.playerData[ player2.id ].hand.contains( cardToGive ) ).toBeTruthy();

		expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: gameData.id } )
			} )
		);

		expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledTimes( 2 );
		expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: player1.id } ),
				data: expect.objectContaining( {
					hand: expect.objectContaining( {
						cards: expect.any( Array<IPlayingCard> )
					} )
				} )
			} )
		);

		expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: player2.id } ),
				data: expect.objectContaining( {
					hand: expect.objectContaining( {
						cards: expect.any( Array<IPlayingCard> )
					} )
				} )
			} )
		);

		expect( mockCtx.prisma.litMove.create ).toHaveBeenCalledWith( {
			data: expect.objectContaining( {
				type: LitMoveType.GIVEN,
				turnId: player2.id,
				description: giveCardMove.description
			} )
		} );

		expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: gameData.id,
				status: LitGameStatus.IN_PROGRESS
			} )
		);
	} );
} );