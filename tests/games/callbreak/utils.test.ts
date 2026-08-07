import { describe, expect, test } from "bun:test";

import { apply } from "@/games/callbreak/server/utils.ts";
import {
	CardPlayedEvent,
	DealDealtEvent,
	DealScoredEvent,
	ScoreInitializedEvent,
	Trick,
	TrickStartedEvent,
	TrickWonEvent,
	WinnerDecidedEvent,
	WinsDeclaredEvent
} from "@/games/callbreak/shared/schema.ts";
import type { CallbreakEvent, CallbreakState } from "@/games/callbreak/shared/schema.ts";
import {
	calculateRoundScore,
	createNewDeal,
	determineTrickWinner,
	emptyTrick,
	getCardValue,
	getPlayableCards,
	PLAYER_COUNT,
	RANK_ORDER,
	TRICKS_PER_DEAL
} from "@/games/callbreak/shared/utils.ts";
import type { CardId, CardSuit } from "@/shared/cards/schema.ts";
import { SORTED_DECK } from "@/shared/cards/utils.ts";
import { PlayerId } from "@/shared/swish/schema.ts";

// Spades are trump everywhere in this file; the fixtures below read as
// "H is the led suit, S beats it".
const TRUMP: CardSuit = "S";

const P1 = PlayerId.make( "p1" );
const P2 = PlayerId.make( "p2" );
const P3 = PlayerId.make( "p3" );
const P4 = PlayerId.make( "p4" );
const SEATS = [ P1, P2, P3, P4 ];

/** A trick built from `[ player, card ]` pairs; the first pair is the lead. */
function trickOf( played: ReadonlyArray<readonly [ PlayerId, CardId ]> ) {
	const [ lead ] = played;
	return Trick.make( {
		leadPlayer: lead![ 0 ],
		suit: lead![ 1 ].charAt( lead![ 1 ].length - 1 ) as CardSuit,
		cards: Object.fromEntries( played ) as Record<PlayerId, CardId>
	} );
}

/** Brands the keys of a plain `{ p1: … }` literal so it can be compared to state. */
const table = ( entries: Record<string, number> ) => entries as Record<PlayerId, number>;

/** The empty `CallbreakState` every fold starts from. */
const EMPTY: CallbreakState = { deals: [], scores: {} };

/** Folds a list of events through the game's reducer. */
const fold = ( state: CallbreakState, events: ReadonlyArray<CallbreakEvent> ) =>
	events.reduce( apply, state );

// ===========================================================================
describe( "callbreak/utils — card values", () => {
	test( "RANK_ORDER runs 2 (lowest) through A (highest)", () => {
		expect( RANK_ORDER ).toHaveLength( 13 );
		expect( RANK_ORDER[ 0 ] ).toBe( "2" );
		expect( RANK_ORDER.at( -1 ) ).toBe( "A" );
	} );

	test( "a card's value is its rank index, independent of suit", () => {
		expect( getCardValue( "2H" ) ).toBe( 0 );
		expect( getCardValue( "10C" ) ).toBe( 8 );
		expect( getCardValue( "JD" ) ).toBe( 9 );
		expect( getCardValue( "AS" ) ).toBe( 12 );
		expect( getCardValue( "AS" ) ).toBe( getCardValue( "AH" ) );
	} );

	test( "the table constants describe a four-handed, thirteen-trick deal", () => {
		expect( PLAYER_COUNT ).toBe( 4 );
		expect( TRICKS_PER_DEAL ).toBe( 13 );
	} );
} );

// ===========================================================================
describe( "callbreak/utils — determineTrickWinner", () => {
	const cases: ReadonlyArray<{
		name: string;
		played: ReadonlyArray<readonly [ PlayerId, CardId ]>;
		winner: PlayerId;
	}> = [
		{
			name: "the highest card of the led suit wins",
			played: [ [ P1, "5H" ], [ P2, "9H" ], [ P3, "KH" ], [ P4, "2H" ] ],
			winner: P3
		},
		{
			name: "the leader keeps the trick when nobody beats it",
			played: [ [ P1, "AH" ], [ P2, "2H" ], [ P3, "3H" ], [ P4, "4H" ] ],
			winner: P1
		},
		{
			name: "off-suit discards never win",
			played: [ [ P1, "5H" ], [ P2, "AD" ], [ P3, "AC" ], [ P4, "2H" ] ],
			winner: P1
		},
		{
			name: "a trump beats the highest card of the led suit",
			played: [ [ P1, "AH" ], [ P2, "KH" ], [ P3, "2S" ], [ P4, "QH" ] ],
			winner: P3
		},
		{
			name: "the highest trump wins a trumped trick",
			played: [ [ P1, "AH" ], [ P2, "2S" ], [ P3, "KS" ], [ P4, "5S" ] ],
			winner: P3
		},
		{
			name: "a trump lead is decided by the highest trump",
			played: [ [ P1, "5S" ], [ P2, "9S" ], [ P3, "2S" ], [ P4, "KS" ] ],
			winner: P4
		},
		{
			name: "a partial trick is decided among the cards played so far",
			played: [ [ P1, "5H" ], [ P2, "9H" ] ],
			winner: P2
		},
		{
			name: "a trick led from the middle of the seating order still resolves",
			played: [ [ P3, "5H" ], [ P4, "9H" ], [ P1, "2S" ], [ P2, "AH" ] ],
			winner: P1
		}
	];

	for ( const { name, played, winner } of cases ) {
		test( name, () => {
			expect( determineTrickWinner( trickOf( played ), TRUMP, [ ...SEATS ] ) ).toBe( winner );
		} );
	}
} );

// ===========================================================================
describe( "callbreak/utils — getPlayableCards (the follow-suit rules)", () => {
	const cases: ReadonlyArray<{
		name: string;
		hand: ReadonlyArray<CardId>;
		trick: ReadonlyArray<readonly [ PlayerId, CardId ]>;
		playable: ReadonlyArray<CardId>;
	}> = [
		{
			name: "leading a trick — every card is playable",
			hand: [ "2H", "AC", "9S" ],
			trick: [],
			playable: [ "2H", "AC", "9S" ]
		},
		{
			name: "holding the led suit — only the led suit may be played",
			hand: [ "KH", "2C", "AS" ],
			trick: [ [ P1, "5H" ] ],
			playable: [ "KH" ]
		},
		{
			name: "holding the led suit — must beat the highest card of it when able",
			hand: [ "2H", "9H" ],
			trick: [ [ P1, "5H" ] ],
			playable: [ "9H" ]
		},
		{
			name: "holding only lower cards of the led suit — any of them will do",
			hand: [ "2H", "3H" ],
			trick: [ [ P1, "AH" ] ],
			playable: [ "2H", "3H" ]
		},
		{
			name: "a trump already beat the led suit — any card of the led suit will do",
			hand: [ "2H", "KH" ],
			trick: [ [ P1, "5H" ], [ P2, "2S" ] ],
			playable: [ "2H", "KH" ]
		},
		{
			name: "void in the led suit but holding trump — must trump",
			hand: [ "2S", "AC", "AD" ],
			trick: [ [ P1, "5H" ] ],
			playable: [ "2S" ]
		},
		{
			name: "void in the led suit and trumped already — must over-trump",
			hand: [ "2S", "9S", "AC" ],
			trick: [ [ P1, "5H" ], [ P2, "3S" ] ],
			playable: [ "9S" ]
		},
		{
			name: "unable to over-trump — the whole hand opens up",
			hand: [ "2S", "AC" ],
			trick: [ [ P1, "5H" ], [ P2, "9S" ] ],
			playable: [ "2S", "AC" ]
		},
		{
			name: "void in the led suit and holding no trump — the whole hand opens up",
			hand: [ "AC", "AD" ],
			trick: [ [ P1, "5H" ] ],
			playable: [ "AC", "AD" ]
		},
		{
			name: "following a trump lead — the head rule still applies",
			hand: [ "2S", "9S" ],
			trick: [ [ P1, "5S" ] ],
			playable: [ "9S" ]
		}
	];

	for ( const { name, hand, trick, playable } of cases ) {
		test( name, () => {
			const result = trick.length === 0
				? getPlayableCards( [ ...hand ], TRUMP, emptyTrick( P1 ) )
				: getPlayableCards( [ ...hand ], TRUMP, trickOf( trick ) );

			expect( result.slice().sort() ).toEqual( [ ...playable ].sort() );
		} );
	}

	test( "every playable card is drawn from the hand it was given", () => {
		const hand: CardId[] = [ "2S", "9S", "AC", "KH" ];
		const trick = trickOf( [ [ P1, "5H" ], [ P2, "3S" ] ] );
		for ( const card of getPlayableCards( hand, TRUMP, trick ) ) {
			expect( hand ).toContain( card );
		}
	} );
} );

// ===========================================================================
describe( "callbreak/utils — scoring", () => {
	test( "making the declared bid exactly pays ten a trick", () => {
		expect( calculateRoundScore( 3, 3 ) ).toBe( 30 );
		expect( calculateRoundScore( 1, 1 ) ).toBe( 10 );
		expect( calculateRoundScore( 13, 13 ) ).toBe( 130 );
	} );

	test( "overtricks pay two apiece on top of the bid", () => {
		expect( calculateRoundScore( 3, 5 ) ).toBe( 34 );
		expect( calculateRoundScore( 2, 13 ) ).toBe( 42 );
	} );

	test( "falling short forfeits ten a trick of the whole bid", () => {
		expect( calculateRoundScore( 3, 2 ) ).toBe( -30 );
		expect( calculateRoundScore( 5, 0 ) ).toBe( -50 );
		expect( calculateRoundScore( 13, 12 ) ).toBe( -130 );
	} );

	test( "a bid of zero is worth nothing either way", () => {
		expect( calculateRoundScore( 0, 0 ) ).toBe( 0 );
		expect( calculateRoundScore( 0, 4 ) ).toBe( 8 );
	} );
} );

// ===========================================================================
describe( "callbreak/utils — dealing", () => {
	test( "a new deal hands thirteen cards to each of four players", () => {
		const deal = createNewDeal( [ ...SEATS ] );
		const hands = SEATS.map( ( pid ) => deal.hands[ pid ]! );

		expect( hands.map( ( h ) => h.length ) ).toEqual( [ 13, 13, 13, 13 ] );
		expect( new Set( hands.flat() ).size ).toBe( 52 );
		expect( hands.flat().slice().sort() ).toEqual( [ ...SORTED_DECK ].sort() );
	} );

	test( "a new deal starts with zeroed declarations, wins, scores and no tricks", () => {
		const deal = createNewDeal( [ ...SEATS ] );

		expect( deal.declarations ).toEqual( table( { p1: 0, p2: 0, p3: 0, p4: 0 } ) );
		expect( deal.wins ).toEqual( table( { p1: 0, p2: 0, p3: 0, p4: 0 } ) );
		expect( deal.scores ).toEqual( table( { p1: 0, p2: 0, p3: 0, p4: 0 } ) );
		expect( deal.tricks ).toEqual( [] );
		expect( deal.id.length ).toBeGreaterThan( 0 );
	} );

	test( "the starting player defaults to the first seat and honours an explicit one", () => {
		expect( createNewDeal( [ ...SEATS ] ).startingPlayer ).toBe( P1 );
		expect( createNewDeal( [ ...SEATS ], P3 ).startingPlayer ).toBe( P3 );
	} );

	test( "an empty trick has a lead player and nothing else", () => {
		expect( emptyTrick( P2 ) ).toEqual( { leadPlayer: P2, cards: {} } );
		expect( emptyTrick() ).toEqual( { leadPlayer: PlayerId.make( "" ), cards: {} } );
	} );
} );

// ===========================================================================
describe( "callbreak/apply — the reducer", () => {
	test( "ScoreInitialized seats a player at zero", () => {
		const state = fold( EMPTY, SEATS.map( ( playerId ) =>
			ScoreInitializedEvent.make( { playerId } ) ) );

		expect( state.scores ).toEqual( table( { p1: 0, p2: 0, p3: 0, p4: 0 } ) );
	} );

	test( "DealDealt pushes the new deal to the front of the history", () => {
		const first = createNewDeal( [ ...SEATS ], P1 );
		const second = createNewDeal( [ ...SEATS ], P2 );
		const state = fold( EMPTY, [
			DealDealtEvent.make( { deal: first } ),
			DealDealtEvent.make( { deal: second } )
		] );

		expect( state.deals.map( ( d ) => d.id ) ).toEqual( [ second.id, first.id ] );
	} );

	test( "a trick plays out: cards leave hands, the suit locks, the winner banks a win", () => {
		const deal = createNewDeal( [ ...SEATS ], P1 );
		const cards = SEATS.map( ( pid ) => deal.hands[ pid ]![ 0 ]! );

		const state = fold( EMPTY, [
			DealDealtEvent.make( { deal } ),
			TrickStartedEvent.make( { leadPlayer: P1 } ),
			...SEATS.map( ( playerId, i ) =>
				CardPlayedEvent.make( { playerId, cardId: cards[ i ]! } ) ),
			TrickWonEvent.make( { winner: P3 } )
		] );

		const active = state.deals[ 0 ]!;
		const trick = active.tricks[ 0 ]!;

		// Each played card is gone from its owner's hand...
		for ( const [ i, pid ] of SEATS.entries() ) {
			expect( active.hands[ pid ] ).toHaveLength( 12 );
			expect( active.hands[ pid ] ).not.toContain( cards[ i ]! );
		}

		// ...and recorded on the trick, whose suit is fixed by the lead card.
		expect( trick.cards ).toEqual( Object.fromEntries( SEATS.map( ( pid, i ) =>
			[ pid, cards[ i ]! ] ) ) );
		expect( trick.suit ).toBe( cards[ 0 ]!.charAt( cards[ 0 ]!.length - 1 ) as CardSuit );
		expect( trick.winner ).toBe( P3 );
		expect( active.wins[ P3 ] ).toBe( 1 );
	} );

	test( "TrickStarted stacks the new trick in front of the finished one", () => {
		const deal = createNewDeal( [ ...SEATS ], P1 );
		const state = fold( EMPTY, [
			DealDealtEvent.make( { deal } ),
			TrickStartedEvent.make( { leadPlayer: P1 } ),
			TrickWonEvent.make( { winner: P2 } ),
			TrickStartedEvent.make( { leadPlayer: P2 } )
		] );

		const tricks = state.deals[ 0 ]!.tricks;
		expect( tricks ).toHaveLength( 2 );
		expect( tricks[ 0 ]!.leadPlayer ).toBe( P2 );
		expect( tricks[ 0 ]!.winner ).toBeUndefined();
		expect( tricks[ 1 ]!.winner ).toBe( P2 );
	} );

	test( "WinsDeclared records each player's bid on the active deal", () => {
		const deal = createNewDeal( [ ...SEATS ], P1 );
		const state = fold( EMPTY, [
			DealDealtEvent.make( { deal } ),
			WinsDeclaredEvent.make( { playerId: P1, wins: 2 } ),
			WinsDeclaredEvent.make( { playerId: P2, wins: 5 } )
		] );

		expect( state.deals[ 0 ]!.declarations ).toEqual( table( { p1: 2, p2: 5, p3: 0, p4: 0 } ) );
	} );

	test( "DealScored writes the round onto the deal and adds it to the running total", () => {
		const first = createNewDeal( [ ...SEATS ], P1 );
		const second = createNewDeal( [ ...SEATS ], P2 );
		const round = { [ P1 ]: 24, [ P2 ]: 32, [ P3 ]: -50, [ P4 ]: -40 };

		const state = fold( EMPTY, [
			...SEATS.map( ( playerId ) => ScoreInitializedEvent.make( { playerId } ) ),
			DealDealtEvent.make( { deal: first } ),
			DealScoredEvent.make( { scores: round } ),
			DealDealtEvent.make( { deal: second } ),
			DealScoredEvent.make( { scores: round } )
		] );

		// Every deal keeps its own round score...
		expect( state.deals[ 0 ]!.scores ).toEqual( round );
		expect( state.deals[ 1 ]!.scores ).toEqual( round );
		// ...and the cumulative table accumulates across deals.
		expect( state.scores ).toEqual( table( { p1: 48, p2: 64, p3: -100, p4: -80 } ) );
	} );

	test( "WinnerDecided stamps the game winner", () => {
		expect( fold( EMPTY, [ WinnerDecidedEvent.make( { winner: P2 } ) ] ).winner ).toBe( P2 );
	} );

	test( "deal-scoped events are inert while no deal is active", () => {
		const events: ReadonlyArray<CallbreakEvent> = [
			WinsDeclaredEvent.make( { playerId: P1, wins: 3 } ),
			TrickStartedEvent.make( { leadPlayer: P1 } ),
			CardPlayedEvent.make( { playerId: P1, cardId: "AS" } ),
			TrickWonEvent.make( { winner: P1 } )
		];

		for ( const event of events ) {
			expect( apply( EMPTY, event ) ).toEqual( EMPTY );
		}

		// DealScored is the exception: the cumulative table lives outside the deal.
		expect( apply( EMPTY, DealScoredEvent.make( { scores: { [ P1 ]: 10 } } ) ).scores )
			.toEqual( table( { p1: 10 } ) );
	} );

	test( "a card played with no trick open still leaves the hand", () => {
		const deal = createNewDeal( [ ...SEATS ], P1 );
		const card = deal.hands[ P1 ]![ 0 ]!;
		const state = fold( EMPTY, [
			DealDealtEvent.make( { deal } ),
			CardPlayedEvent.make( { playerId: P1, cardId: card } )
		] );

		expect( state.deals[ 0 ]!.hands[ P1 ] ).not.toContain( card );
		expect( state.deals[ 0 ]!.tricks ).toHaveLength( 0 );
	} );

	test( "a trick won with no trick open still banks the win", () => {
		const deal = createNewDeal( [ ...SEATS ], P1 );
		const state = fold( EMPTY, [
			DealDealtEvent.make( { deal } ),
			TrickWonEvent.make( { winner: P4 } )
		] );

		expect( state.deals[ 0 ]!.wins[ P4 ] ).toBe( 1 );
		expect( state.deals[ 0 ]!.tricks ).toHaveLength( 0 );
	} );
} );
