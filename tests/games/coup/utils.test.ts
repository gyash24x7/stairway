import { describe, expect, test } from "bun:test";

import {
	COUP_ASSASSINATE_COST,
	COUP_COUP_COST,
	COUP_MANDATORY_COUP_COINS,
	CoupView
} from "@/games/coup/shared/schema.ts";
import {
	blockersFor,
	canBlockWith,
	claimFor,
	costOf,
	isAlive,
	isBlockable,
	isChallengeable,
	legalActions,
	livingOpponents,
	livingPlayers,
	mustCoup,
	needsTarget,
	stealAmount,
	visibleCopies
} from "@/games/coup/shared/utils.ts";

import type { ActionKind } from "@/games/coup/shared/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

const player = ( id: string ) => id as PlayerId;

const [ a, b, c ] = [ "a", "b", "c" ].map( player );
const seats = [ a, b, c ];

const seat = ( over: { coins?: number; influenceCount?: number } = {} ) => ( {
	coins: over.coins ?? 2,
	influenceCount: over.influenceCount ?? 2
} );

const view = ( over: Partial<CoupView> = {} ) => CoupView.make( {
	playerData: { [ a ]: seat(), [ b ]: seat(), [ c ]: seat() },
	deckCount: 9,
	influence: [],
	eliminationOrder: [],
	log: [],
	...over
} );


describe( "what an action is", () => {
	test( "only the four character actions claim anything", () => {
		expect( claimFor( "tax" ) ).toBe( "duke" );
		expect( claimFor( "assassinate" ) ).toBe( "assassin" );
		expect( claimFor( "steal" ) ).toBe( "captain" );
		expect( claimFor( "exchange" ) ).toBe( "ambassador" );

		// Anybody may take these, so there is nothing to call a bluff on.
		expect( claimFor( "income" ) ).toBeUndefined();
		expect( claimFor( "foreignAid" ) ).toBeUndefined();
		expect( claimFor( "coup" ) ).toBeUndefined();
	} );

	test( "challengeable is exactly the same set", () => {
		const challengeable = ( [
			"income", "foreignAid", "coup", "tax", "assassinate", "steal", "exchange"
		] as Array<ActionKind> ).filter( isChallengeable );

		expect( challengeable ).toEqual( [ "tax", "assassinate", "steal", "exchange" ] );
	} );

	test( "three actions can be blocked, and only by their own characters", () => {
		expect( blockersFor( "foreignAid" ) ).toEqual( [ "duke" ] );
		expect( blockersFor( "assassinate" ) ).toEqual( [ "contessa" ] );
		expect( blockersFor( "steal" ) ).toEqual( [ "captain", "ambassador" ] );

		expect( blockersFor( "income" ) ).toEqual( [] );
		expect( blockersFor( "coup" ) ).toEqual( [] );
		expect( blockersFor( "tax" ) ).toEqual( [] );
		expect( blockersFor( "exchange" ) ).toEqual( [] );
	} );

	test( "a coup cannot be stopped by anything", () => {
		expect( isChallengeable( "coup" ) ).toBe( false );
		expect( isBlockable( "coup" ) ).toBe( false );
	} );

	test( "a steal is stopped by either of two characters", () => {
		expect( canBlockWith( "steal", "captain" ) ).toBe( true );
		expect( canBlockWith( "steal", "ambassador" ) ).toBe( true );
		expect( canBlockWith( "steal", "contessa" ) ).toBe( false );
	} );

	test( "only the two removal actions cost anything", () => {
		expect( costOf( "coup" ) ).toBe( COUP_COUP_COST );
		expect( costOf( "assassinate" ) ).toBe( COUP_ASSASSINATE_COST );
		expect( costOf( "income" ) ).toBe( 0 );
		expect( costOf( "tax" ) ).toBe( 0 );
	} );

	test( "only the three actions aimed at somebody need a target", () => {
		expect( needsTarget( "coup" ) ).toBe( true );
		expect( needsTarget( "assassinate" ) ).toBe( true );
		expect( needsTarget( "steal" ) ).toBe( true );
		expect( needsTarget( "income" ) ).toBe( false );
		expect( needsTarget( "exchange" ) ).toBe( false );
	} );
} );


describe( "what a seat may do", () => {
	test( "a poor seat cannot buy its way to a removal", () => {
		const actions = legalActions( 0 );

		expect( actions ).toContain( "income" );
		expect( actions ).toContain( "tax" );
		expect( actions ).not.toContain( "assassinate" );
		expect( actions ).not.toContain( "coup" );
	} );

	test( "an assassination unlocks at its cost", () => {
		expect( legalActions( COUP_ASSASSINATE_COST - 1 ) ).not.toContain( "assassinate" );
		expect( legalActions( COUP_ASSASSINATE_COST ) ).toContain( "assassinate" );
	} );

	test( "a coup unlocks at its cost", () => {
		expect( legalActions( COUP_COUP_COST - 1 ) ).not.toContain( "coup" );
		expect( legalActions( COUP_COUP_COST ) ).toContain( "coup" );
	} );

	test( "ten coins leaves exactly one thing to do", () => {
		expect( mustCoup( COUP_MANDATORY_COUP_COINS - 1 ) ).toBe( false );
		expect( mustCoup( COUP_MANDATORY_COUP_COINS ) ).toBe( true );

		// Not merely "coup is available" — it is the only option offered.
		expect( legalActions( COUP_MANDATORY_COUP_COINS ) ).toEqual( [ "coup" ] );
		expect( legalActions( 20 ) ).toEqual( [ "coup" ] );
	} );
} );


describe( "reading the table", () => {
	test( "a seat is alive while it still holds a card", () => {
		expect( isAlive( seat( { influenceCount: 2 } ) ) ).toBe( true );
		expect( isAlive( seat( { influenceCount: 1 } ) ) ).toBe( true );
		expect( isAlive( seat( { influenceCount: 0 } ) ) ).toBe( false );
		expect( isAlive( undefined ) ).toBe( false );
	} );

	test( "the dead are dropped from the table, in seating order", () => {
		const table = view( {
			playerData: {
				[ a ]: seat(),
				[ b ]: seat( { influenceCount: 0 } ),
				[ c ]: seat()
			}
		} );

		expect( livingPlayers( table, seats ) ).toEqual( [ a, c ] );
		expect( livingOpponents( table, seats, a ) ).toEqual( [ c ] );
	} );

	test( "a seat accounts for the copies in its own hand, and nothing else", () => {
		const table = view( { influence: [ "duke", "duke" ] } );

		// A card given up goes back into the deck, so there is no pile to count and
		// a seat's own hand is the whole of its evidence.
		expect( visibleCopies( table, "duke" ) ).toBe( 2 );
		expect( visibleCopies( table, "captain" ) ).toBe( 0 );
	} );

	test( "holding two leaves one unaccounted for, never zero", () => {
		const table = view( { influence: [ "duke", "contessa" ] } );

		// The most a seat can ever see is two of the three, so no claim is provably
		// a bluff — which is the whole point of the card going back.
		expect( visibleCopies( table, "duke" ) ).toBeLessThan( 3 );
	} );

	test( "the table's own view accounts for nothing at all", () => {
		const table = view( { influence: [] } );

		expect( visibleCopies( table, "duke" ) ).toBe( 0 );
	} );
} );


describe( "stealing", () => {
	test( "takes two when the target can afford it", () => {
		expect( stealAmount( 2 ) ).toBe( 2 );
		expect( stealAmount( 7 ) ).toBe( 2 );
	} );

	test( "takes what is there when it is less", () => {
		expect( stealAmount( 1 ) ).toBe( 1 );
	} );

	test( "takes nothing from an empty treasury, rather than refusing", () => {
		// The Captain was still played, and can still be challenged for it.
		expect( stealAmount( 0 ) ).toBe( 0 );
	} );
} );
