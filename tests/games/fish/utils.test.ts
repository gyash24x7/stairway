import { describe, expect, test } from "bun:test";

import { apply } from "@/games/fish/server/utils.ts";
import type { FishState } from "@/games/fish/shared/schema.ts";
import {
	BookClaimed,
	CardAsked,
	HandsDealt,
	PlayerSeated,
	TeamsCreated,
	TurnTransferred,
	WinningTeamDecided
} from "@/games/fish/shared/schema.ts";
import {
	buildConfig,
	getAskDescription,
	getBookDisplayString,
	getBookForCard,
	getBooksInHand,
	getBookSuit,
	getCardsOfBook,
	getClaimDescription,
	getClaimedBooks,
	getMissingCards,
	getOpponents,
	getTeamForPlayer,
	getTeammates,
	getTransferDescription,
	isBookInHand
} from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId, PlayerInfo } from "@/shared/swish/schema.ts";
import { player } from "@tests/_helpers/swish.ts";

/** Retypes a plain object literal as one of the branded `PlayerId`-keyed maps. */
const byPlayer = <T>( o: Record<string, T> ) => o as Record<PlayerId, T>;

const P1 = player( "p1" );
const P2 = player( "p2" );
const P3 = player( "p3" );
const P4 = player( "p4" );

const ROSTER: Record<PlayerId, PlayerInfo> = {
	[ P1.id ]: P1,
	[ P2.id ]: P2,
	[ P3.id ]: P3,
	[ P4.id ]: P4
};

const TEAMS = {
	T1: { id: "T1", name: "Red", members: [ P1.id, P3.id ], score: 0, booksWon: [] },
	T2: { id: "T2", name: "Blue", members: [ P2.id, P4.id ], score: 0, booksWon: [] }
};

const NO_METRICS = {
	totalAsks: 0,
	cardsGiven: 0,
	cardsTaken: 0,
	totalClaims: 0,
	successfulClaims: 0
};

/** The state `setup` produces, optionally patched for the case under test. */
const makeState = ( over: Partial<FishState> = {} ) => ( {
	playerData: {},
	teams: {},
	hands: {},
	cardCounts: {},
	cardLocations: {},
	askHistory: [],
	claimHistory: [],
	transferHistory: [],
	...over
} as FishState );

/** A dealt, team-assigned state — the shape every PLAY-phase event folds onto. */
const dealtState = ( hands: Record<PlayerId, CardId[]> ) => {
	const players = Object.keys( hands ) as PlayerId[];
	const cardCounts: Record<string, number> = {};
	const cardLocations: Record<string, PlayerId[]> = {};
	const playerData: Record<string, { teamId: string; metrics: typeof NO_METRICS }> = {};

	for ( const pid of players ) {
		cardCounts[ pid ] = hands[ pid ]!.length;
		playerData[ pid ] = {
			teamId: TEAMS.T1.members.includes( pid ) ? "T1" : "T2",
			metrics: { ...NO_METRICS }
		};

		for ( const card of hands[ pid ]! ) {
			cardLocations[ card ] = [ ...players ];
		}
	}

	return makeState( {
		hands,
		cardCounts: byPlayer( cardCounts ),
		cardLocations,
		playerData: byPlayer( playerData ),
		teams: { ...TEAMS }
	} );
};

// ===========================================================================
describe( "fish/apply — seating & setup events", () => {
	test( "PlayerSeated creates an unassigned seat with zeroed metrics", () => {
		const next = apply( makeState(), PlayerSeated.make( { playerId: P1.id } ) );
		expect( next.playerData[ P1.id ] ).toEqual( { teamId: "", metrics: NO_METRICS } );
	} );

	test( "TeamsCreated stamps every member with its team id", () => {
		let state = makeState();
		for ( const p of [ P1, P2, P3, P4 ] ) {
			state = apply( state, PlayerSeated.make( { playerId: p.id } ) );
		}

		const next = apply( state, TeamsCreated.make( {
			teams: [
				{ id: "T1", name: "Red", members: [ P1.id, P3.id ] },
				{ id: "T2", name: "Blue", members: [ P2.id, P4.id ] }
			]
		} ) );

		expect( next.teams[ "T1" ] ).toEqual( {
			id: "T1", name: "Red", members: [ P1.id, P3.id ], score: 0, booksWon: []
		} );
		expect( next.playerData[ P1.id ]!.teamId ).toBe( "T1" );
		expect( next.playerData[ P2.id ]!.teamId ).toBe( "T2" );
	} );

	test( "HandsDealt installs the deal verbatim (replay is exact)", () => {
		const hands = { [ P1.id ]: [ "AC" ], [ P2.id ]: [ "AD" ] } as Record<PlayerId, CardId[]>;
		const next = apply( makeState(), HandsDealt.make( {
			hands,
			cardCounts: { [ P1.id ]: 1, [ P2.id ]: 1 },
			cardLocations: { AC: [ P1.id, P2.id ], AD: [ P1.id, P2.id ] }
		} ) );

		expect( next.hands ).toEqual( hands );
		expect( next.cardCounts ).toEqual( byPlayer( { p1: 1, p2: 1 } ) );
	} );

	test( "WinningTeamDecided records the winner", () => {
		const next = apply( makeState(), WinningTeamDecided.make( { teamId: "T1" } ) );
		expect( next.winningTeam ).toBe( "T1" );
	} );

	test( "TurnTransferred prepends to the transfer history", () => {
		const next = apply( makeState(), TurnTransferred.make( {
			playerId: P1.id, transferTo: P3.id, timestamp: 1
		} ) );

		expect( next.lastMoveType ).toBe( "transfer" );
		expect( next.transferHistory ).toEqual( [
			{ playerId: P1.id, transferTo: P3.id, timestamp: 1 }
		] );
	} );
} );

// ===========================================================================
describe( "fish/apply — CardAsked", () => {
	const hands = {
		[ P1.id ]: [ "AC", "2C" ],
		[ P2.id ]: [ "AD", "2D" ],
		[ P3.id ]: [ "AH", "2H" ],
		[ P4.id ]: [ "AS", "2S" ]
	} as Record<PlayerId, CardId[]>;

	test( "a successful ask moves the card and pins its location", () => {
		const next = apply( dealtState( hands ), CardAsked.make( {
			success: true, playerId: P1.id, from: P2.id, cardId: "AD" as CardId, timestamp: 1
		} ) );

		expect( next.hands[ P1.id ] ).toEqual( [ "AC", "2C", "AD" ] as CardId[] );
		expect( next.hands[ P2.id ] ).toEqual( [ "2D" ] as CardId[] );
		expect( next.cardCounts ).toEqual( byPlayer( { p1: 3, p2: 1, p3: 2, p4: 2 } ) );
		expect( next.cardLocations[ "AD" ] ).toEqual( [ P1.id ] );
		expect( next.playerData[ P1.id ]!.metrics ).toMatchObject( {
			totalAsks: 1, cardsTaken: 1
		} );
		expect( next.playerData[ P2.id ]!.metrics.cardsGiven ).toBe( 1 );
	} );

	test( "a failed ask rules out both the asker and the asked", () => {
		const next = apply( dealtState( hands ), CardAsked.make( {
			success: false, playerId: P1.id, from: P2.id, cardId: "AH" as CardId, timestamp: 1
		} ) );

		expect( next.cardLocations[ "AH" ] ).toEqual( [ P3.id, P4.id ] );
		expect( next.hands ).toEqual( hands );
		expect( next.playerData[ P1.id ]!.metrics ).toMatchObject( {
			totalAsks: 1, cardsTaken: 0
		} );
		expect( next.askHistory[ 0 ]!.success ).toBe( false );
	} );

	test( "emptying a player drops them from every remaining card's owners", () => {
		const thin = {
			[ P1.id ]: [ "AC" ],
			[ P2.id ]: [ "AD" ],
			[ P3.id ]: [ "AH" ],
			[ P4.id ]: [ "AS" ]
		} as Record<PlayerId, CardId[]>;

		const next = apply( dealtState( thin ), CardAsked.make( {
			success: true, playerId: P1.id, from: P2.id, cardId: "AD" as CardId, timestamp: 1
		} ) );

		expect( next.cardCounts[ P2.id ] ).toBe( 0 );
		for ( const card of [ "AC", "AH", "AS" ] ) {
			expect( next.cardLocations[ card ] ).not.toContain( P2.id );
		}
	} );
} );

// ===========================================================================
describe( "fish/apply — BookClaimed", () => {
	// The 7 matters: `bookTypeOf` infers the variant from whether a seven is still
	// tracked, so a NORMAL fixture has to keep one in play.
	const hands = {
		[ P1.id ]: [ "AC", "AD", "2C" ],
		[ P2.id ]: [ "AH", "2D" ],
		[ P3.id ]: [ "AS", "2H" ],
		[ P4.id ]: [ "2S", "7C" ]
	} as Record<PlayerId, CardId[]>;

	const correctClaim = { AC: P1.id, AD: P1.id, AH: P2.id, AS: P3.id };

	test( "a correct claim scores the claimer's team and clears the book", () => {
		const next = apply( dealtState( hands ), BookClaimed.make( {
			success: true,
			playerId: P1.id,
			book: "ACES",
			winningTeamId: "T1",
			correctClaim,
			actualClaim: correctClaim,
			timestamp: 1
		} ) );

		expect( next.teams[ "T1" ]!.score ).toBe( 1 );
		expect( next.teams[ "T1" ]!.booksWon ).toEqual( [ "ACES" ] );
		expect( next.teams[ "T2" ]!.score ).toBe( 0 );
		expect( next.hands[ P1.id ] ).toEqual( [ "2C" ] as CardId[] );
		expect( next.cardCounts ).toEqual( byPlayer( { p1: 1, p2: 1, p3: 1, p4: 2 } ) );
		for ( const card of [ "AC", "AD", "AH", "AS" ] ) {
			expect( next.cardLocations[ card ] ).toBeUndefined();
		}

		expect( next.lastMoveType ).toBe( "claim" );
		expect( next.playerData[ P1.id ]!.metrics ).toMatchObject( {
			totalClaims: 1, successfulClaims: 1
		} );
	} );

	test( "a wrong claim scores the other team but still clears the book", () => {
		const next = apply( dealtState( hands ), BookClaimed.make( {
			success: false,
			playerId: P1.id,
			book: "ACES",
			winningTeamId: "T2",
			correctClaim,
			actualClaim: { AC: P1.id, AD: P1.id, AH: P3.id, AS: P2.id },
			timestamp: 1
		} ) );

		expect( next.teams[ "T2" ]!.score ).toBe( 1 );
		expect( next.teams[ "T1" ]!.score ).toBe( 0 );
		expect( next.playerData[ P1.id ]!.metrics ).toMatchObject( {
			totalClaims: 1, successfulClaims: 0
		} );
		expect( next.claimHistory[ 0 ]!.success ).toBe( false );
	} );
} );

// ===========================================================================
describe( "fish/utils — books", () => {
	test( "getBookForCard maps a card to its rank book or suit half", () => {
		expect( getBookForCard( "AC" as CardId, "NORMAL" ) ).toBe( "ACES" );
		expect( getBookForCard( "10S" as CardId, "NORMAL" ) ).toBe( "TENS" );
		expect( getBookForCard( "AC" as CardId, "CANADIAN" ) ).toBe( "LC" );
		expect( getBookForCard( "KH" as CardId, "CANADIAN" ) ).toBe( "UH" );
	} );

	test( "getBooksInHand de-duplicates the books a hand touches", () => {
		const hand = [ "AC", "AD", "2C" ] as CardId[];
		expect( getBooksInHand( hand, "NORMAL" ) ).toEqual( [ "ACES", "TWOS" ] );
		expect( getBooksInHand( hand, "CANADIAN" ) ).toEqual( [ "LC", "LD" ] );
	} );

	test( "isBookInHand answers for both variants", () => {
		const hand = [ "AC", "2C" ] as CardId[];
		expect( isBookInHand( hand, "ACES", "NORMAL" ) ).toBe( true );
		expect( isBookInHand( hand, "KINGS", "NORMAL" ) ).toBe( false );
	} );

	test( "getMissingCards lists what the hand still needs", () => {
		expect( getMissingCards( [ "AC", "AD" ] as CardId[], "ACES", "NORMAL" ) )
			.toEqual( [ "AH", "AS" ] as CardId[] );
		expect( getMissingCards( [ "AC" ] as CardId[], "LC", "CANADIAN" ) )
			.toEqual( [ "2C", "3C", "4C", "5C", "6C" ] as CardId[] );
	} );

	test( "getCardsOfBook optionally intersects with a hand", () => {
		expect( getCardsOfBook( "ACES", "NORMAL" ) ).toHaveLength( 4 );
		expect( getCardsOfBook( "LC", "CANADIAN" ) ).toHaveLength( 6 );
		expect( getCardsOfBook( "ACES", "NORMAL", [ "AC", "2C" ] as CardId[] ) )
			.toEqual( [ "AC" ] as CardId[] );
	} );

	test( "getBookDisplayString and getBookSuit render the Canadian halves", () => {
		expect( getBookDisplayString( "ACES", "NORMAL" ) ).toBe( "ACES" );
		expect( getBookDisplayString( "LC", "CANADIAN" ) ).toBe( "LOW ♣" );
		expect( getBookDisplayString( "UH", "CANADIAN" ) ).toBe( "HIGH ♥" );
		expect( getBookSuit( "ACES", "NORMAL" ) ).toBeUndefined();
		expect( getBookSuit( "US", "CANADIAN" ) ).toBe( "S" );
	} );

	test( "getClaimedBooks pools every team's winnings", () => {
		const state = makeState( {
			teams: {
				T1: { ...TEAMS.T1, booksWon: [ "ACES" ] },
				T2: { ...TEAMS.T2, booksWon: [ "KINGS", "TWOS" ] }
			}
		} );

		expect( getClaimedBooks( state ).sort() ).toEqual( [ "ACES", "KINGS", "TWOS" ] );
	} );
} );

// ===========================================================================
describe( "fish/utils — teams", () => {
	test( "getTeamForPlayer finds the owning team", () => {
		expect( getTeamForPlayer( TEAMS, P1.id ) ).toBe( "T1" );
		expect( getTeamForPlayer( TEAMS, P4.id ) ).toBe( "T2" );
	} );

	test( "getTeammates excludes the player themselves", () => {
		expect( getTeammates( TEAMS, P1.id ) ).toEqual( [ P3.id ] );
	} );

	test( "getOpponents lists every member of every other team", () => {
		expect( getOpponents( TEAMS, P1.id ).sort() ).toEqual( [ P2.id, P4.id ] );
	} );
} );

// ===========================================================================
describe( "fish/utils — descriptions & config", () => {
	test( "an ask reads differently depending on whether it landed", () => {
		const ask = {
			success: true, playerId: P1.id, from: P2.id, cardId: "AH" as CardId, timestamp: 1
		};

		expect( getAskDescription( ask, ROSTER ) )
			.toBe( "P1 asked P2 for ACE OF HEARTS and got the card!" );
		expect( getAskDescription( { ...ask, success: false }, ROSTER ) )
			.toBe( "P1 asked P2 for ACE OF HEARTS and was declined!" );
	} );

	test( "a claim reads with the book's display name", () => {
		const claim = {
			success: true,
			playerId: P1.id,
			book: "ACES",
			correctClaim: {},
			actualClaim: {},
			timestamp: 1
		};

		expect( getClaimDescription( claim, ROSTER, "NORMAL" ) ).toBe( "P1 declared ACES correctly!" );
		expect( getClaimDescription( { ...claim, success: false, book: "LC" }, ROSTER, "CANADIAN" ) )
			.toBe( "P1 declared LOW ♣ incorrectly!" );
	} );

	test( "a transfer names both players", () => {
		expect( getTransferDescription(
			{ playerId: P1.id, transferTo: P3.id, timestamp: 1 },
			ROSTER
		) ).toBe( "P1 transferred the turn to P3" );
	} );

	test( "buildConfig derives the deck and books from the variant", () => {
		const normal = buildConfig( 4, "NORMAL", 2 );
		expect( normal ).toMatchObject( {
			playerCount: 4, teamCount: 2, deckType: 52, bookSize: 4, autoStart: true
		} );
		expect( normal.books ).toHaveLength( 13 );

		const canadian = buildConfig( 6, "CANADIAN", 3 );
		expect( canadian ).toMatchObject( {
			playerCount: 6, teamCount: 3, deckType: 48, bookSize: 6
		} );
		expect( canadian.books ).toHaveLength( 8 );
	} );
} );
