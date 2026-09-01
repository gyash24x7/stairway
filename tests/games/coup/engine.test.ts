import { createInput, runGame, testClock, topFrame } from "@tests/helpers/runner.ts";
import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { coup } from "@/games/coup/server/engine.ts";
import {
	COUP_ASSASSINATE_COST,
	COUP_BLOCK_ACTION,
	COUP_CHALLENGE_ACTION,
	COUP_CHALLENGE_BLOCK,
	COUP_COPIES_PER_CHARACTER,
	COUP_COUP_COST,
	COUP_EXCHANGE,
	COUP_LOSE_INFLUENCE,
	COUP_MANDATORY_COUP_COINS,
	COUP_STARTING_COINS,
	COUP_STARTING_INFLUENCE,
	CoupConfig
} from "@/games/coup/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";

import type { ActionKind, CharacterCard } from "@/games/coup/shared/schema.ts";
import type { PlayerId as Player } from "@/swish/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c ] = [ "a", "b", "c" ].map( player );
const seats = [ a, b, c ];

const info = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const config = ( over: Partial<CoupConfig> = {} ) => CoupConfig.make( {
	playerCount: 3,
	autoStart: false,
	moveTimeoutMillis: 60_000,
	interactionTimeoutMillis: 15_000,
	...over
} );

/** Seats three players at a coup table and starts it, then runs the body. */
const table = <A, E>(
	body: ( engine: Effect.Success<typeof coup> ) => Effect.Effect<A, E>,
	over: Partial<CoupConfig> = {},
	now?: () => number
) => runGame(
	coup,
	engine => Effect.gen( function* () {
		yield* engine.initialize( createInput( config( over ) ) );
		yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
		yield* engine.start( a );
		return yield* body( engine );
	} ),
	now === undefined ? {} : { now }
);

type Hands = Record<Player, ReadonlyArray<CharacterCard>>;

/** Every seat's own cards, read off the view each of them is served. */
const handsOf = ( engine: Effect.Success<typeof coup> ) => Effect.gen( function* () {
	const views = yield* Effect.forEach( seats, id => engine.getView( id ) );
	return Object.fromEntries(
		seats.map( ( id, at ) => [ id, views[ at ]!.view.influence ] )
	) as Hands;
} );

/**
 * Deals until the table suits the scenario, then plays it out.
 *
 * A game's seed is the engine's own and a test cannot set it, so a scenario that
 * turns on a particular seat holding a particular card deals again until one
 * does. Setting a table up costs well under a millisecond, and it keeps the
 * scenarios honest: the game under test is the real one, dealt the real way,
 * rather than a state hand-built to prove a point.
 */
const dealUntil = <A, E>(
	suits: ( hands: Hands ) => boolean,
	body: ( engine: Effect.Success<typeof coup>, hands: Hands ) => Effect.Effect<A, E>,
	over: Partial<CoupConfig> = {},
	now?: () => number
) => {
	for ( let attempt = 0; attempt < 500; attempt++ ) {
		const { result } = table( engine => Effect.gen( function* () {
			const hands = yield* handsOf( engine );

			return suits( hands )
				? { dealt: true as const, value: yield* body( engine, hands ) }
				: { dealt: false as const };
		} ), over, now );

		if ( result.dealt ) {
			return result.value;
		}
	}

	throw new Error( "no deal matched the scenario in 500 attempts" );
};

/** The four characters an action can claim, and what claiming them is called. */
const CLAIMED: ReadonlyArray<{ action: ActionKind; card: CharacterCard }> = [
	{ action: "tax", card: "duke" },
	{ action: "steal", card: "captain" },
	{ action: "exchange", card: "ambassador" }
];

/** An action the seat can back up, and one it cannot. */
const honestFor = ( hand: ReadonlyArray<CharacterCard> ) =>
	CLAIMED.find( entry => hand.includes( entry.card ) );

const bluffFor = ( hand: ReadonlyArray<CharacterCard> ) =>
	CLAIMED.find( entry => !hand.includes( entry.card ) );

/** Walks a seat's coins up by taking income, a full turn at a time. */
const incomeRound = ( engine: Effect.Success<typeof coup> ) => Effect.gen( function* () {
	for ( const id of seats ) {
		yield* engine.takeAction( { input: { action: "income" }, playerId: id } );
	}
} );


describe( "setting the table", () => {
	test( "everyone is dealt two cards and two coins", () => {
		const { result } = table( engine => Effect.gen( function* () {
			return { table: yield* engine.getView(), mine: yield* engine.getView( a ) };
		} ) );

		for ( const id of seats ) {
			expect( result.table.view.playerData[ id ]?.influenceCount )
				.toBe( COUP_STARTING_INFLUENCE );
			expect( result.table.view.playerData[ id ]?.coins ).toBe( COUP_STARTING_COINS );
		}

		expect( result.mine.view.influence ).toHaveLength( COUP_STARTING_INFLUENCE );
	} );

	test( "what is dealt comes out of a fifteen card deck", () => {
		const { result } = table( engine => engine.getView() );

		const dealt = seats.length * COUP_STARTING_INFLUENCE;
		const full = COUP_COPIES_PER_CHARACTER * 5;

		expect( result.view.deckCount ).toBe( full - dealt );
	} );

	test( "a seat sees its own cards and nobody else's", () => {
		const { result } = table( engine => engine.getView( a ) );

		// Every other seat is a count on this view, never a list.
		expect( result.view.influence ).toHaveLength( 2 );
		expect( result.view.playerData[ b ] ).not.toHaveProperty( "influence" );
		expect( result.view.playerData[ b ]?.influenceCount ).toBe( 2 );
	} );

	test( "the table's own view holds nobody's cards", () => {
		const { result } = table( engine => engine.getView() );

		expect( result.view.influence ).toEqual( [] );
		expect( result.view.playerId ).toBeUndefined();
	} );
} );


describe( "actions nobody can stop", () => {
	test( "income pays one and ends the turn on the spot", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "income" }, playerId: a } );
			return yield* engine.getView();
		} ) );

		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS + 1 );
		expect( result.context.interactions ).toEqual( [] );
		expect( result.context.currentPlayer ).toBe( b );
	} );

	test( "a coup is neither challenged nor blocked", () => {
		const { result } = table( engine => Effect.gen( function* () {
			// Three rounds of income puts the opener on five, then two more turns
			// each take it past the cost of a coup.
			yield* incomeRound( engine );
			yield* incomeRound( engine );
			yield* incomeRound( engine );
			yield* incomeRound( engine );
			yield* incomeRound( engine );
			yield* engine.takeAction( { input: { action: "coup", target: b }, playerId: a } );
			return yield* engine.getView();
		} ) );

		// Straight to the target's choice of which card to give up.
		expect( topFrame( result.context.interactions )?.kind ).toBe( COUP_LOSE_INFLUENCE );
		expect( topFrame( result.context.interactions )?.target ).toBe( b );
		expect( result.view.playerData[ a ]?.coins ).toBe( 7 - COUP_COUP_COST );
	} );

	test( "a coup nobody can afford is refused", () => {
		const { result } = table( engine => Effect.gen( function* () {
			return yield* engine.takeAction( {
				input: { action: "coup", target: b },
				playerId: a
			} ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "ten coins leaves nothing to do but coup", () => {
		const { result } = table( engine => Effect.gen( function* () {
			for ( let round = 0; round < COUP_MANDATORY_COUP_COINS - COUP_STARTING_COINS; round++ ) {
				yield* incomeRound( engine );
			}

			const refused = yield* engine.takeAction( {
				input: { action: "income" },
				playerId: a
			} ).pipe( Effect.flip );

			return { refused, view: yield* engine.getView() };
		} ) );

		expect( result.view.view.playerData[ a ]?.coins ).toBeGreaterThanOrEqual(
			COUP_MANDATORY_COUP_COINS
		);
		expect( result.refused._tag ).toBe( "swish/InvalidMove" );
	} );
} );


describe( "declaring a claim", () => {
	test( "a character action opens a challenge window to the whole table", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "tax" }, playerId: a } );
			return yield* engine.getView();
		} ) );

		const open = topFrame( result.context.interactions );

		expect( open?.kind ).toBe( COUP_CHALLENGE_ACTION );
		expect( open?.responders ).toEqual( [ b, c ] );
		expect( open?.mode ).toBe( "simultaneous" );

		// The turn is suspended, not spent.
		expect( result.context.currentPlayer ).toBe( a );
	} );

	test( "foreign aid claims nothing, so it goes straight to the block window", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "foreignAid" }, playerId: a } );
			return yield* engine.getView();
		} ) );

		const open = topFrame( result.context.interactions );

		expect( open?.kind ).toBe( COUP_BLOCK_ACTION );
		expect( open?.responders ).toEqual( [ b, c ] );
	} );

	test( "a claim everyone lets stand pays out", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "tax" }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );
			return yield* engine.getView();
		} ) );

		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS + 3 );
		expect( result.context.interactions ).toEqual( [] );
		expect( result.context.currentPlayer ).toBe( b );
	} );

	test( "an action aimed at nobody is refused a target", () => {
		const { result } = table( engine => engine.takeAction( {
			input: { action: "tax", target: b },
			playerId: a
		} ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "an action aimed at somebody needs one", () => {
		const { result } = table( engine => engine.takeAction( {
			input: { action: "steal" },
			playerId: a
		} ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "nobody may aim at themselves", () => {
		const { result } = table( engine => engine.takeAction( {
			input: { action: "steal", target: a },
			playerId: a
		} ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );
} );


describe( "challenging a claim", () => {
	test( "a proven claim costs the challenger an influence, and the action still lands", () => {
		const result = dealUntil(
			hands => honestFor( hands[ a ] ) !== undefined,
			( engine, hands ) => Effect.gen( function* () {
				const honest = honestFor( hands[ a ] )!;

				yield* engine.takeAction( {
					input: {
						action: honest.action,
						...( honest.action === "steal" ? { target: c } : {} )
					},
					playerId: a
				} );
				yield* engine.challenge( { input: { challenge: true }, playerId: b } );

				return { view: yield* engine.getView(), mine: yield* engine.getView( a ), honest };
			} )
		);

		// The challenger is the one being asked to give something up.
		const open = topFrame( result.view.context.interactions );

		expect( open?.kind ).toBe( COUP_LOSE_INFLUENCE );
		expect( open?.target ).toBe( b );

		// The proven card went back to the deck and a fresh one came out, so the
		// hand is the same size but the deck's contents have moved on.
		expect( result.mine.view.influence ).toHaveLength( 2 );
	} );

	test( "a bluffed claim costs the bluffer, and the action does not happen", () => {
		const result = dealUntil(
			hands => bluffFor( hands[ a ] ) !== undefined,
			( engine, hands ) => Effect.gen( function* () {
				const bluff = bluffFor( hands[ a ] )!;

				yield* engine.takeAction( {
					input: {
						action: bluff.action,
						...( bluff.action === "steal" ? { target: c } : {} )
					},
					playerId: a
				} );
				yield* engine.challenge( { input: { challenge: true }, playerId: b } );

				return { view: yield* engine.getView(), bluff };
			} )
		);

		const open = topFrame( result.view.context.interactions );

		// The bluffer pays, not the challenger.
		expect( open?.kind ).toBe( COUP_LOSE_INFLUENCE );
		expect( open?.target ).toBe( a );

		// Nothing was collected on the way.
		expect( result.view.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS );
	} );

	test( "the bluffer gives up a card and the turn moves on", () => {
		const result = dealUntil(
			hands => bluffFor( hands[ a ] ) !== undefined,
			( engine, hands ) => Effect.gen( function* () {
				const bluff = bluffFor( hands[ a ] )!;
				const surrendered = hands[ a ][ 0 ]!;
				const deckBefore = ( yield* engine.getView() ).view.deckCount;

				yield* engine.takeAction( {
					input: {
						action: bluff.action,
						...( bluff.action === "steal" ? { target: c } : {} )
					},
					playerId: a
				} );
				yield* engine.challenge( { input: { challenge: true }, playerId: b } );
				yield* engine.surrenderInfluence( { input: { card: surrendered }, playerId: a } );

				return {
					view: yield* engine.getView(),
					mine: yield* engine.getView( a ),
					surrendered,
					deckBefore
				};
			} )
		);

		expect( result.view.view.playerData[ a ]?.influenceCount ).toBe( 1 );

		// The card left the hand and went back into the deck rather than face up on
		// the table, so the hand's size is the only trace of it. Nothing anywhere
		// records which character it was.
		expect( result.mine.view.influence ).toHaveLength( 1 );
		expect( result.view.view.deckCount ).toBe( result.deckBefore + 1 );

		expect( result.view.context.interactions ).toEqual( [] );
		expect( result.view.context.currentPlayer ).toBe( b );
	} );

	test( "the first challenge to land is the one that counts", () => {
		const result = dealUntil(
			hands => bluffFor( hands[ a ] ) !== undefined,
			( engine, hands ) => Effect.gen( function* () {
				const bluff = bluffFor( hands[ a ] )!;

				yield* engine.takeAction( {
					input: {
						action: bluff.action,
						...( bluff.action === "steal" ? { target: c } : {} )
					},
					playerId: a
				} );

				// b speaks first and the window shuts on the spot, so c never gets to.
				yield* engine.challenge( { input: { challenge: true }, playerId: b } );
				const late = yield* engine.challenge( {
					input: { challenge: true },
					playerId: c
				} ).pipe( Effect.flip );

				return { late, view: yield* engine.getView() };
			} )
		);

		expect( topFrame( result.view.context.interactions )?.kind ).toBe( COUP_LOSE_INFLUENCE );
		expect( result.late._tag ).toBeDefined();
	} );

	test( "nobody outside the window may answer it", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "tax" }, playerId: a } );

			// The claimant is not one of their own challengers.
			return yield* engine.challenge( {
				input: { challenge: true },
				playerId: a
			} ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBeDefined();
	} );
} );


describe( "blocking an action", () => {
	test( "a block on foreign aid opens the window to doubt it", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "foreignAid" }, playerId: a } );
			yield* engine.block( { input: { block: "duke" }, playerId: b } );
			return yield* engine.getView();
		} ) );

		const open = topFrame( result.context.interactions );

		expect( open?.kind ).toBe( COUP_CHALLENGE_BLOCK );
		expect( open?.target ).toBe( b );

		// Everyone but the blocker may call it, the thwarted seat included.
		expect( open?.responders ).toEqual( [ a, c ] );
	} );

	test( "a block nobody doubts stops the action dead", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "foreignAid" }, playerId: a } );
			yield* engine.block( { input: { block: "duke" }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );
			return yield* engine.getView();
		} ) );

		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS );
		expect( result.context.interactions ).toEqual( [] );
		expect( result.context.currentPlayer ).toBe( b );
	} );

	test( "foreign aid nobody blocks pays two", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "foreignAid" }, playerId: a } );
			yield* engine.block( { input: { block: null }, playerId: b } );
			yield* engine.block( { input: { block: null }, playerId: c } );
			return yield* engine.getView();
		} ) );

		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS + 2 );
		expect( result.context.currentPlayer ).toBe( b );
	} );

	test( "a character that cannot stop the action is refused", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "foreignAid" }, playerId: a } );

			// Only the Duke stops foreign aid.
			return yield* engine.block( {
				input: { block: "contessa" },
				playerId: b
			} ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "an honest block costs the seat that doubted it, and still stops the action", () => {
		const result = dealUntil(
			hands => hands[ b ].includes( "duke" ),
			( engine ) => Effect.gen( function* () {
				yield* engine.takeAction( { input: { action: "foreignAid" }, playerId: a } );
				yield* engine.block( { input: { block: "duke" }, playerId: b } );
				yield* engine.challenge( { input: { challenge: true }, playerId: a } );
				return yield* engine.getView();
			} )
		);

		const open = topFrame( result.context.interactions );

		// The doubter pays for it.
		expect( open?.kind ).toBe( COUP_LOSE_INFLUENCE );
		expect( open?.target ).toBe( a );

		// And the aid still never arrives.
		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS );
	} );

	test( "a bluffed block costs the blocker, and the action lands anyway", () => {
		const result = dealUntil(
			hands => !hands[ b ].includes( "duke" ),
			( engine, hands ) => Effect.gen( function* () {
				yield* engine.takeAction( { input: { action: "foreignAid" }, playerId: a } );
				yield* engine.block( { input: { block: "duke" }, playerId: b } );
				yield* engine.challenge( { input: { challenge: true }, playerId: a } );
				yield* engine.surrenderInfluence( {
					input: { card: hands[ b ][ 0 ]! },
					playerId: b
				} );

				return yield* engine.getView();
			} )
		);

		// The blocker paid for the bluff...
		expect( result.view.playerData[ b ]?.influenceCount ).toBe( 1 );

		// ...and nothing was left between the action and its payout.
		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS + 2 );
		expect( result.context.interactions ).toEqual( [] );
	} );
} );


describe( "assassination", () => {
	/** Walks every seat up to three coins, so an assassination is affordable. */
	const funded = ( engine: Effect.Success<typeof coup> ) => incomeRound( engine );

	test( "the fee is spent when the assassin is sent", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* funded( engine );
			yield* engine.takeAction( {
				input: { action: "assassinate", target: b },
				playerId: a
			} );

			return yield* engine.getView();
		} ) );

		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS + 1 - COUP_ASSASSINATE_COST );
		expect( topFrame( result.context.interactions )?.kind ).toBe( COUP_CHALLENGE_ACTION );
	} );

	test( "the fee is gone even when the assassin turns out to be a bluff", () => {
		const result = dealUntil(
			hands => !hands[ a ].includes( "assassin" ),
			( engine ) => Effect.gen( function* () {
				yield* funded( engine );
				yield* engine.takeAction( {
					input: { action: "assassinate", target: b },
					playerId: a
				} );
				yield* engine.challenge( { input: { challenge: true }, playerId: b } );

				return yield* engine.getView();
			} )
		);

		// Three coins for nothing, and an influence still to give up.
		expect( result.view.playerData[ a ]?.coins )
			.toBe( COUP_STARTING_COINS + 1 - COUP_ASSASSINATE_COST );
		expect( topFrame( result.context.interactions )?.target ).toBe( a );
		expect( result.view.playerData[ b ]?.influenceCount ).toBe( 2 );
	} );

	test( "a target that doubts a real assassin can lose both cards in one turn", () => {
		const result = dealUntil(
			hands => hands[ a ].includes( "assassin" ),
			( engine, hands ) => Effect.gen( function* () {
				yield* funded( engine );
				yield* engine.takeAction( {
					input: { action: "assassinate", target: b },
					playerId: a
				} );

				// b doubts it, and it was real.
				yield* engine.challenge( { input: { challenge: true }, playerId: b } );
				yield* engine.surrenderInfluence( {
					input: { card: hands[ b ][ 0 ]! },
					playerId: b
				} );

				const midway = yield* engine.getView();

				// The assassination itself is still to come — and b has one card left.
				const open = topFrame( midway.context.interactions );

				// b may still play the Contessa, so the block window comes first.
				yield* engine.block( { input: { block: null }, playerId: b } );
				yield* engine.surrenderInfluence( {
					input: { card: hands[ b ][ 1 ]! },
					playerId: b
				} );

				return { midway, open, view: yield* engine.getView() };
			} )
		);

		expect( result.midway.view.playerData[ b ]?.influenceCount ).toBe( 1 );

		// Both cards gone in a single turn, and the seat is out.
		expect( result.view.view.playerData[ b ]?.influenceCount ).toBe( 0 );
		expect( result.view.context.seats[ b ] ).toBe( "eliminated" );
		expect( result.view.view.eliminationOrder ).toEqual( [ b ] );
	} );

	test( "a Contessa nobody doubts saves the target", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* funded( engine );
			yield* engine.takeAction( {
				input: { action: "assassinate", target: b },
				playerId: a
			} );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );
			yield* engine.block( { input: { block: "contessa" }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );

			return yield* engine.getView();
		} ) );

		expect( result.view.playerData[ b ]?.influenceCount ).toBe( 2 );
		expect( result.context.interactions ).toEqual( [] );
		expect( result.context.currentPlayer ).toBe( b );
	} );

	test( "only the target may play the Contessa", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* funded( engine );
			yield* engine.takeAction( {
				input: { action: "assassinate", target: b },
				playerId: a
			} );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );

			const open = ( yield* engine.getView() ).context.interactions.slice( -1 )[ 0 ];

			const refused = yield* engine.block( {
				input: { block: "contessa" },
				playerId: c
			} ).pipe( Effect.flip );

			return { open, refused };
		} ) );

		expect( result.open?.kind ).toBe( COUP_BLOCK_ACTION );
		expect( result.open?.responders ).toEqual( [ b ] );
		expect( result.refused._tag ).toBeDefined();
	} );
} );


describe( "stealing", () => {
	test( "takes two coins across", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "steal", target: b }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );
			yield* engine.block( { input: { block: null }, playerId: b } );

			return yield* engine.getView();
		} ) );

		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS + 2 );
		expect( result.view.playerData[ b ]?.coins ).toBe( COUP_STARTING_COINS - 2 );
	} );

	test( "a Captain or an Ambassador stops it", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "steal", target: b }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );
			yield* engine.block( { input: { block: "ambassador" }, playerId: b } );

			return yield* engine.getView();
		} ) );

		expect( topFrame( result.context.interactions )?.kind ).toBe( COUP_CHALLENGE_BLOCK );
	} );

	test( "an empty treasury is still a legal thing to rob", () => {
		const { result } = table( engine => Effect.gen( function* () {
			// b is robbed down to nothing, then robbed again.
			yield* engine.takeAction( { input: { action: "steal", target: b }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );
			yield* engine.block( { input: { block: null }, playerId: b } );

			yield* engine.takeAction( { input: { action: "income" }, playerId: b } );
			yield* engine.takeAction( { input: { action: "income" }, playerId: c } );

			yield* engine.takeAction( { input: { action: "steal", target: b }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );
			yield* engine.block( { input: { block: null }, playerId: b } );

			return yield* engine.getView();
		} ) );

		// b had one coin left, so only one moved.
		expect( result.view.playerData[ b ]?.coins ).toBe( 0 );
		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS + 3 );
	} );
} );


describe( "exchanging", () => {
	test( "the draw is offered to the exchanging seat alone", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "exchange" }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );

			return { mine: yield* engine.getView( a ), theirs: yield* engine.getView( b ) };
		} ) );

		expect( topFrame( result.mine.context.interactions )?.kind ).toBe( COUP_EXCHANGE );
		expect( result.mine.view.exchangeDraw ).toHaveLength( 2 );

		// Nobody else may see what came off the deck.
		expect( result.theirs.view.exchangeDraw ).toBeUndefined();
	} );

	test( "the seat keeps as many as it came in with", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "exchange" }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );

			const mine = yield* engine.getView( a );
			const pool = [ ...mine.view.influence, ...( mine.view.exchangeDraw ?? [] ) ];

			yield* engine.exchangeCards( {
				input: { keep: pool.slice( 0, 2 ) },
				playerId: a
			} );

			return { after: yield* engine.getView( a ), table: yield* engine.getView() };
		} ) );

		expect( result.after.view.influence ).toHaveLength( 2 );
		expect( result.after.view.exchangeDraw ).toBeUndefined();
		expect( result.table.context.currentPlayer ).toBe( b );

		// Two came off the deck and two went back, so it is the size it started.
		expect( result.table.view.deckCount ).toBe( 9 );
	} );

	test( "keeping the wrong number is refused", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "exchange" }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );

			const mine = yield* engine.getView( a );

			return yield* engine.exchangeCards( {
				input: { keep: [ mine.view.influence[ 0 ]! ] },
				playerId: a
			} ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "keeping a card that was never offered is refused", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "exchange" }, playerId: a } );
			yield* engine.challenge( { input: { challenge: false }, playerId: b } );
			yield* engine.challenge( { input: { challenge: false }, playerId: c } );

			const mine = yield* engine.getView( a );
			const pool = [ ...mine.view.influence, ...( mine.view.exchangeDraw ?? [] ) ];

			// Four of a character can never be on offer: there are only three.
			const greedy = [ "duke", "duke", "duke", "duke" ] as Array<CharacterCard>;
			const tooMany = greedy.slice( 0, 2 );

			return pool.filter( card => card === "duke" ).length >= 2
				? undefined
				: yield* engine.exchangeCards( {
					input: { keep: tooMany },
					playerId: a
				} ).pipe( Effect.flip );
		} ) );

		// Either the deal made the check moot, or the move was refused.
		expect( result === undefined || result._tag === "swish/InvalidMove" ).toBe( true );
	} );
} );


describe( "going out", () => {
	test( "a seat that loses both cards is out and skipped", () => {
		const result = dealUntil(
			hands => bluffFor( hands[ b ] ) !== undefined,
			( engine, hands ) => Effect.gen( function* () {
				const bluff = bluffFor( hands[ b ] )!;

				// b bluffs twice over and pays for it both times.
				for ( const card of hands[ b ] ) {
					yield* engine.takeAction( { input: { action: "income" }, playerId: a } );
					yield* engine.takeAction( {
						input: {
							action: bluff.action,
							...( bluff.action === "steal" ? { target: a } : {} )
						},
						playerId: b
					} );
					yield* engine.challenge( { input: { challenge: true }, playerId: a } );
					yield* engine.surrenderInfluence( { input: { card }, playerId: b } );

					if ( ( yield* engine.getView() ).view.playerData[ b ]?.influenceCount === 0 ) {
						break;
					}

					yield* engine.takeAction( { input: { action: "income" }, playerId: c } );
				}

				return yield* engine.getView();
			} )
		);

		expect( result.view.playerData[ b ]?.influenceCount ).toBe( 0 );
		expect( result.context.seats[ b ] ).toBe( "eliminated" );

		// The turn order steps over the empty seat.
		expect( result.context.currentPlayer ).not.toBe( b );
	} );

	test( "an eliminated seat is never asked to respond", () => {
		const result = dealUntil(
			hands => bluffFor( hands[ b ] ) !== undefined,
			( engine, hands ) => Effect.gen( function* () {
				const bluff = bluffFor( hands[ b ] )!;

				for ( const card of hands[ b ] ) {
					yield* engine.takeAction( { input: { action: "income" }, playerId: a } );
					yield* engine.takeAction( {
						input: {
							action: bluff.action,
							...( bluff.action === "steal" ? { target: a } : {} )
						},
						playerId: b
					} );
					yield* engine.challenge( { input: { challenge: true }, playerId: a } );
					yield* engine.surrenderInfluence( { input: { card }, playerId: b } );

					if ( ( yield* engine.getView() ).view.playerData[ b ]?.influenceCount === 0 ) {
						break;
					}

					yield* engine.takeAction( { input: { action: "income" }, playerId: c } );
				}

				const at = ( yield* engine.getView() ).context.currentPlayer;
				yield* engine.takeAction( { input: { action: "tax" }, playerId: at } );

				return yield* engine.getView();
			} )
		);

		expect( topFrame( result.context.interactions )?.responders ).not.toContain( b );
	} );
} );


describe( "the clock", () => {
	test( "an unanswered challenge window lets the claim through", () => {
		const clock = testClock();

		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "tax" }, playerId: a } );

			clock.advance( 20_000 );
			yield* engine.alarm();

			return yield* engine.getView();
		} ), {}, clock.now );

		// Silence is a pass: the Duke was never doubted, so the tax is paid.
		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS + 3 );
		expect( result.context.interactions ).toEqual( [] );
	} );

	test( "an unanswered block window lets the action through", () => {
		const clock = testClock();

		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.takeAction( { input: { action: "foreignAid" }, playerId: a } );

			clock.advance( 20_000 );
			yield* engine.alarm();

			return yield* engine.getView();
		} ), {}, clock.now );

		expect( result.view.playerData[ a ]?.coins ).toBe( COUP_STARTING_COINS + 2 );
	} );

	test( "a seat that will not choose loses its first card", () => {
		const clock = testClock();

		const result = dealUntil(
			hands => bluffFor( hands[ a ] ) !== undefined,
			( engine, hands ) => Effect.gen( function* () {
				const bluff = bluffFor( hands[ a ] )!;

				yield* engine.takeAction( {
					input: {
						action: bluff.action,
						...( bluff.action === "steal" ? { target: c } : {} )
					},
					playerId: a
				} );
				yield* engine.challenge( { input: { challenge: true }, playerId: b } );

				clock.advance( 60_000 );
				yield* engine.alarm();

				return {
					view: yield* engine.getView(),
					mine: yield* engine.getView( a ),
					first: hands[ a ][ 0 ]!,
					second: hands[ a ][ 1 ]!
				};
			} ),
			{},
			clock.now
		);

		// The first card is the one that goes, so the second is what is left.
		expect( result.view.view.playerData[ a ]?.influenceCount ).toBe( 1 );
		expect( result.mine.view.influence ).toEqual( [ result.second ] );
	} );
} );
