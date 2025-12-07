import { CARD_SUITS, type CardId } from "@s2h/utils/cards";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Round, StartedRound } from "../src/types.ts";
import { compareCards, getBestCardPlayed, getPlayableCards, suggestCardToPlay, suggestDealWins } from "../src/utils.ts";

describe( "Callbreak:Utils", () => {
	const mockRound: Round = {
		id: "r-mock-1",
		playerOrder: [ "a", "b", "c", "d" ],
		status: "CREATED",
		suit: undefined,
		cards: {},
		createdAt: Date.now()
	};

	afterEach( () => {
		vi.restoreAllMocks();
	} );

	describe( "compareCards()", () => {
		it( "should return false for different suits", () => {
			expect( compareCards( "AH", "KS" ) ).toBe( false );
		} );

		it( "should return false when card2 is ace", () => {
			expect( compareCards( "KS", "AS" ) ).toBe( false );
		} );

		it( "should return true when card1 is ace", () => {
			expect( compareCards( "AS", "KS" ) ).toBe( true );
		} );

		it( "should compare non-ace ranks properly (king > queen)", () => {
			expect( compareCards( "KC", "QC" ) ).toBe( true );
			expect( compareCards( "QC", "KC" ) ).toBe( false );
		} );
	} );

	describe( "getBestCardPlayed()", () => {
		it( "should prefer highest trump when present", () => {
			const trump = CARD_SUITS.HEARTS;
			const round: StartedRound = {
				...mockRound,
				suit: CARD_SUITS.SPADES,
				cards: { a: "2H", b: "AS", c: "KH" }
			};

			expect( getBestCardPlayed( trump, round ) ).toBe( "KH" );
		} );

		it( "should use round suit when no trump present", () => {
			const trump = CARD_SUITS.DIAMONDS;
			const round: StartedRound = {
				...mockRound,
				suit: CARD_SUITS.SPADES,
				cards: { a: "10S", b: "AC", c: "JS" }
			};

			expect( getBestCardPlayed( trump, round ) ).toBe( "JS" );
		} );

		it( "should fall back to highest among others when no trump or round suit", () => {
			const trump = CARD_SUITS.CLUBS;
			const round: StartedRound = {
				...mockRound,
				suit: CARD_SUITS.SPADES,
				cards: { a: "9S", b: "KH", c: "10D" }
			};
			expect( getBestCardPlayed( trump, round ) ).toBe( "9S" );
		} );
	} );

	describe( "getPlayableCards()", () => {
		it( "should return entire hand when round has no suit", () => {
			const playable = getPlayableCards( [ "AS", "2H" ], CARD_SUITS.SPADES, mockRound );
			expect( playable ).toEqual( [ "AS", "2H" ] );
		} );

		it( "should return hand when round suit equals trump and player has no trump", () => {
			const round: Round = { ...mockRound, suit: CARD_SUITS.SPADES, cards: { a: "2S" } };
			const playable = getPlayableCards( [ "AH", "KH" ], CARD_SUITS.SPADES, round );
			expect( playable ).toEqual( [ "AH", "KH" ] );
		} );

		it( "should return greater trump when round suit equals trump and player has trump", () => {
			const trump = CARD_SUITS.HEARTS;
			const round: Round = { ...mockRound, suit: trump, cards: { a: "JH" } };
			const playable = getPlayableCards( [ "2H", "QH" ], trump, round );
			expect( playable ).toEqual( [ "QH" ] );
		} );

		it( "should return trumps when player has no round suit but has trump and greatest is non-trump", () => {
			const trump = CARD_SUITS.DIAMONDS;
			const round: Round = { ...mockRound, suit: CARD_SUITS.SPADES, cards: { a: "3S", b: "4S" } };
			const playable = getPlayableCards( [ "2D", "9D", "5C", "AH" ], trump, round );
			expect( playable ).toEqual( [ "2D", "9D" ] );
		} );

		it( "when player lacks round suit and greatest is trump returns greater trumps or hand", () => {
			const trump = CARD_SUITS.SPADES;
			const round: Round = {
				...mockRound,
				suit: CARD_SUITS.HEARTS,
				cards: { a: "5H", b: "QH", c: "8S" }
			};

			const playable = getPlayableCards( [ "7S", "JS", "2C" ], trump, round );
			expect( playable ).toEqual( [ "JS" ] );
		} );

		it( "when player has round suit and can beat greatest returns only greater cards", () => {
			const trump = CARD_SUITS.CLUBS;
			const round: Round = { ...mockRound, suit: CARD_SUITS.HEARTS, cards: { a: "QH" } };
			const playable = getPlayableCards( [ "KH", "2H" ], trump, round );
			expect( playable ).toEqual( [ "KH" ] );
		} );
	} );

	describe( "suggestDealWins()", () => {
		it( "should count big ranks in trump and other heuristics", () => {
			const trump = CARD_SUITS.HEARTS;
			const hand: CardId[] = [ "AH", "10H", "7H", "6H", "AC", "QC", "10C", "5S", "3S", "QD", "10D", "6D", "2D" ];
			const wins = suggestDealWins( hand, trump );
			expect( wins ).toBe( 5 );
		} );

		it( "should return minimum 2 for very poor hand", () => {
			const trump = CARD_SUITS.CLUBS;
			const hand: CardId[] = [ "4H", "3H", "2H", "5C", "4C", "3C", "2C", "10S", "9S", "8S", "6S", "4D", "3D" ];
			expect( suggestDealWins( hand, trump ) ).toBe( 2 );
		} );
	} );

	describe( "suggestCardToPlay()", () => {
		it( "should prefer unbeatable card if present", () => {
			const trump = CARD_SUITS.HEARTS;
			const hand: CardId[] = [ "KS", "JS", "9S" ];
			const round: Round = {
				...mockRound,
				suit: CARD_SUITS.SPADES,
				cards: { a: "6S", b: "8S" }
			};
			const selected = suggestCardToPlay( hand, trump, [ "AS", "QS" ], round );
			expect( selected ).toBe( "JS" );
		} );

		it( "should fall back to deterministic random when no unbeatable", () => {
			vi.spyOn( Math, "random" ).mockReturnValue( 0.5 );
			const trump = CARD_SUITS.SPADES;
			const selected = suggestCardToPlay( [ "2H", "3H", "4H" ], trump, [], mockRound );
			expect( selected ).toBe( "3H" );
		} );
	} );
} );
