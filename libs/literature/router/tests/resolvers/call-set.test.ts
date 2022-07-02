import type { InferMutationInput, LitTrpcContext } from "../../src/types";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";
import type { LitPlayer, User } from "@prisma/client";
import { LitGameStatus, LitMoveType, LitTeam } from "@prisma/client";
import { literatureRouter } from "@s2h/literature/router";
import { CardHand, CardRank, CardSet, cardSetMap, CardSuit, IPlayingCard } from "@s2h/cards";
import type { TRPCError } from "@trpc/server";
import { Messages } from "../../src/constants";
import cuid from "cuid";
import { EnhancedLitGame } from "@s2h/literature/utils";

describe( "Call Set Mutation", function () {

	let input: InferMutationInput<"call-set">;
	let gameData: MockLitGameData;
	let player1: LitPlayer;
	let player2: LitPlayer;
	let player3: LitPlayer;
	let player4: LitPlayer;
	let player5: LitPlayer;
	let player6: LitPlayer;
	let team1: LitTeam;
	let team2: LitTeam;
	let mockLoggedInUser: User;
	let mockCtx: LitMockContext;
	let caller: ReturnType<typeof literatureRouter.createCaller>;

	beforeEach( function () {
		gameData = new MockLitGameData( { playerCount: 6 } );
		gameData.generatePlayer();
		gameData.generatePlayer();
		gameData.generatePlayer();
		gameData.generatePlayer();
		gameData.generatePlayer();
		gameData.generatePlayer();
		[ team1, team2 ] = gameData.generateTeams();
		[ player1, player2, player3, player4, player5, player6 ] = gameData.dealCards();
		mockLoggedInUser = createMockUser( player1.userId, player1.name );
		mockCtx = createMockContext( mockLoggedInUser );
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );

		caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );
	} );

	it( "should throw error if any called player not part of game", function () {
		input = {
			gameId: gameData.id,
			data: {
				[ cuid() ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
				[ player1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.SPADES } ],
			}
		};

		expect.assertions( 2 );
		return caller.mutation( "call-set", input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.PLAYER_NOT_FOUND );
			} );
	} );

	it( "should throw error if user's cards not called out", function () {
		input = {
			gameId: gameData.id,
			data: {
				[ player4.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
			}
		};

		expect.assertions( 2 );
		return caller.mutation( "call-set", input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_CALL );
			} );
	} );

	it( "should throw error if duplicate cards are called", function () {
		input = {
			gameId: gameData.id,
			data: {
				[ player4.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
				[ player1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
			}
		};

		expect.assertions( 2 );
		return caller.mutation( "call-set", input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.DUPLICATES_IN_CALL );
			} );
	} );

	it( "should throw error if more than one set called", function () {
		input = {
			gameId: gameData.id,
			data: {
				[ player1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
				[ player4.id ]: [ { rank: CardRank.TWO, suit: CardSuit.SPADES } ],
			}
		};

		expect.assertions( 2 );
		return caller.mutation( "call-set", input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CALL_CARDS_OF_SAME_SET );
			} );
	} );

	it( "should throw error if user doesn't have cards of calling set", function () {
		gameData.setHand( player1.id, CardHand.from( { cards: [ { rank: CardRank.TWO, suit: CardSuit.SPADES } ] } ) );
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
		caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );

		input = {
			gameId: gameData.id,
			data: {
				[ player1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
				[ player2.id ]: [ { rank: CardRank.ACE, suit: CardSuit.HEARTS } ],
				[ player3.id ]: [ { rank: CardRank.THREE, suit: CardSuit.HEARTS } ],
				[ player4.id ]: [ { rank: CardRank.FOUR, suit: CardSuit.HEARTS } ],
				[ player5.id ]: [ { rank: CardRank.FIVE, suit: CardSuit.HEARTS } ],
				[ player6.id ]: [ { rank: CardRank.SIX, suit: CardSuit.HEARTS } ],
			}
		};

		expect.assertions( 2 );
		return caller.mutation( "call-set", input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CANNOT_CALL_SET_THAT_YOU_DONT_HAVE );
			} );
	} );

	it( "should throw error if cards called outside the team", function () {
		input = {
			gameId: gameData.id,
			data: {
				[ player1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ],
				[ player4.id ]: [
					{ rank: CardRank.THREE, suit: CardSuit.HEARTS },
					{ rank: CardRank.FIVE, suit: CardSuit.HEARTS },
					{ rank: CardRank.FOUR, suit: CardSuit.HEARTS },
					{ rank: CardRank.SIX, suit: CardSuit.HEARTS },
					{ rank: CardRank.ACE, suit: CardSuit.HEARTS }
				],
			}
		};

		expect.assertions( 2 );
		return caller.mutation( "call-set", input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CALL_WITHIN_YOUR_TEAM );
			} );
	} );

	it( "should throw error if 6 cards not called", function () {
		input = {
			gameId: gameData.id,
			data: {
				[ player1.id ]: [ { rank: CardRank.TWO, suit: CardSuit.HEARTS } ]
			}
		};

		expect.assertions( 2 );
		return caller.mutation( "call-set", input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.CALL_ALL_CARDS );
			} );
	} );

	it( "should increase score for team if called correct and return updated game", async function () {
		[ player1, player2, player3, player4, player5, player6 ] = gameData.dealCardsForSuccessfulCall();
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );

		const smallHearts = cardSetMap[ CardSet.SMALL_HEARTS ];

		input = {
			gameId: gameData.id,
			data: {
				[ player1.id ]: [ smallHearts[ 0 ], smallHearts[ 1 ] ],
				[ player2.id ]: [ smallHearts[ 2 ], smallHearts[ 3 ] ],
				[ player3.id ]: [ smallHearts[ 4 ], smallHearts[ 5 ] ],
			}
		};

		mockCtx.prisma.litTeam.update.mockResolvedValue( { ...team1, score: 1 } );

		const callSuccessMove = gameData.generateMove(
			LitMoveType.CALL_SUCCESS,
			{ turnPlayer: player1, cardSet: CardSet.SMALL_HEARTS, callingPlayer: player1 }
		);

		mockCtx.prisma.litMove.create.mockResolvedValue( callSuccessMove );

		mockCtx.prisma.litPlayer.update
			.mockResolvedValueOnce( { ...player1, hand: gameData.removeCardsOfSetFromHand( player1.id ) } )
			.mockResolvedValueOnce( { ...player2, hand: gameData.removeCardsOfSetFromHand( player2.id ) } )
			.mockResolvedValueOnce( { ...player3, hand: gameData.removeCardsOfSetFromHand( player3.id ) } );

		caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );

		const game = await caller.mutation( "call-set", input );
		const enhancedGame = new EnhancedLitGame( game );

		expect( enhancedGame.id ).toBe( gameData.id );
		expect( enhancedGame.playerData[ player1.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( enhancedGame.playerData[ player2.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( enhancedGame.playerData[ player3.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( enhancedGame.teamData[ player1.teamId! ].score ).toBe( 1 );

		expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: gameData.id } )
			} )
		);

		expect( mockCtx.prisma.litTeam.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: player1.teamId } ),
				data: expect.objectContaining( {
					score: expect.objectContaining( { increment: 1 } )
				} )
			} )
		)

		expect( mockCtx.prisma.litMove.create ).toHaveBeenCalledWith( {
			data: expect.objectContaining( {
				type: LitMoveType.CALL_SUCCESS,
				turnId: player1.id,
				description: callSuccessMove.description
			} )
		} );

		expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledTimes( 3 );
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

		expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: player3.id } ),
				data: expect.objectContaining( {
					hand: expect.objectContaining( {
						cards: expect.any( Array<IPlayingCard> )
					} )
				} )
			} )
		);

		expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: gameData.id,
				status: LitGameStatus.IN_PROGRESS
			} )
		);
	} );

	it( "should increase score for other team if called wrong and return updated game", async function () {
		[ player1, player2, player3, player4, player5, player6 ] = gameData.dealCardsForSuccessfulCall();
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );

		const smallHearts = cardSetMap[ CardSet.SMALL_HEARTS ];

		input = {
			gameId: gameData.id,
			data: {
				[ player1.id ]: [ smallHearts[ 2 ], smallHearts[ 1 ], smallHearts[ 4 ] ],
				[ player2.id ]: [ smallHearts[ 0 ], smallHearts[ 3 ], smallHearts[ 5 ] ]
			}
		};

		mockCtx.prisma.litTeam.update.mockResolvedValue( { ...team2, score: 1 } );

		const callFailMove = gameData.generateMove(
			LitMoveType.CALL_FAIL,
			{ turnPlayer: player4, cardSet: CardSet.SMALL_HEARTS, callingPlayer: player1 }
		);

		mockCtx.prisma.litMove.create.mockResolvedValue( callFailMove );

		mockCtx.prisma.litPlayer.update
			.mockResolvedValueOnce( { ...player1, hand: gameData.removeCardsOfSetFromHand( player1.id ) } )
			.mockResolvedValueOnce( { ...player2, hand: gameData.removeCardsOfSetFromHand( player2.id ) } )
			.mockResolvedValueOnce( { ...player3, hand: gameData.removeCardsOfSetFromHand( player3.id ) } );

		caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );

		const game = await caller.mutation( "call-set", input );
		const enhancedGame = new EnhancedLitGame( game );

		expect( enhancedGame.id ).toBe( gameData.id );
		expect( enhancedGame.playerData[ player1.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( enhancedGame.playerData[ player2.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( enhancedGame.playerData[ player3.id ].hand.containsSome( smallHearts ) ).toBeFalsy();
		expect( enhancedGame.teamData[ player4.teamId! ].score ).toBe( 1 );

		expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: gameData.id } )
			} )
		);

		expect( mockCtx.prisma.litTeam.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: player4.teamId } ),
				data: expect.objectContaining( {
					score: expect.objectContaining( { increment: 1 } )
				} )
			} )
		)

		expect( mockCtx.prisma.litMove.create ).toHaveBeenCalledWith( {
			data: expect.objectContaining( {
				type: LitMoveType.CALL_FAIL,
				turnId: player4.id,
				description: callFailMove.description
			} )
		} );

		expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledTimes( 3 );
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

		expect( mockCtx.prisma.litPlayer.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: player3.id } ),
				data: expect.objectContaining( {
					hand: expect.objectContaining( {
						cards: expect.any( Array<IPlayingCard> )
					} )
				} )
			} )
		);

		expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: gameData.id,
				status: LitGameStatus.IN_PROGRESS
			} )
		);
	} );

} );