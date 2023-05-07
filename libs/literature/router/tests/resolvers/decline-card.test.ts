import { LitGameStatus, LitMove, LitMoveType, LitPlayer, User } from "@prisma/client";
import { CardRank, CardSuit, PlayingCard } from "@s2h/cards";
import { literatureRouter as router } from "@s2h/literature/router";
import type { inferProcedureInput, TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { Messages } from "../../src/constants";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";

describe( "Decline Card Mutation", function () {

	let gameData: MockLitGameData;
	let player1: LitPlayer;
	let player2: LitPlayer;
	let input: inferProcedureInput<typeof router["declineCard"]>;
	let cardDeclined: PlayingCard;
	let askMove: LitMove;
	let declineMove: LitMove;
	let mockLoggedInUser: User;
	let mockCtx: LitMockContext;

	beforeEach( function () {
		gameData = new MockLitGameData();
		gameData.generatePlayer();
		gameData.generatePlayer();
		[ player1, player2 ] = gameData.dealCards( true );

		cardDeclined = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.SPADES } );
		input = { gameId: gameData.id, cardDeclined };

		askMove = gameData.generateMove(
			LitMoveType.ASK,
			{ askedFrom: player1, askedBy: player2, askedFor: cardDeclined }
		);
		declineMove = gameData.generateMove(
			LitMoveType.DECLINED,
			{ askingPlayer: player2, declinedPlayer: player1, card: cardDeclined },
			false
		);

		mockLoggedInUser = createMockUser( player1.userId, player1.name );
		mockCtx = createMockContext( mockLoggedInUser );
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
		mockCtx.prisma.litMove.create.mockResolvedValue( declineMove );
	} );

	it( "should throw error if declining player has that card", function () {
		input.cardDeclined = { rank: CardRank.TWO, suit: CardSuit.HEARTS };

		expect.assertions( 2 );
		return router.createCaller( mockCtx ).declineCard( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_DECLINE_CARD );
			} );
	} );

	it( "should decline card to the player and return updated game", async function () {
		const game = await router.createCaller( mockCtx ).declineCard( input );

		expect( game.id ).toBe( gameData.id );
		expect( game.moves ).toEqual( [ declineMove, askMove ] );

		expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: gameData.id } )
			} )
		);

		expect( mockCtx.prisma.litMove.create ).toHaveBeenCalledWith( {
			data: expect.objectContaining( {
				type: LitMoveType.DECLINED,
				turnId: player1.id,
				description: declineMove.description
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