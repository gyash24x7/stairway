import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { decideMove } from "@/games/splendor/server/bot.ts";
import { splendor } from "@/games/splendor/server/engine.ts";
import type {
	Card,
	PickTokensInput,
	SplendorConfig,
	SplendorView
} from "@/games/splendor/shared/schema.ts";
import {
	SPLENDOR_DEFAULT_WINNING_POINTS,
	SPLENDOR_GOLD_SUPPLY,
	SPLENDOR_MAX_RESERVED,
	SPLENDOR_MOVE_TIMEOUT_MILLIS,
	SPLENDOR_NOBLE_VISIT,
	SPLENDOR_OPEN_CARDS,
	SPLENDOR_TOKEN_SUPPLY,
	SPLENDOR_WINNING_POINTS
} from "@/games/splendor/shared/schema.ts";
import { discountedCost, GEMS, paymentFor, sumTokens } from "@/games/splendor/shared/utils.ts";
import type { InteractionFrame, InvalidMove, PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { createInput, runGame, testClock } from "@tests/helpers/runner.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b ] = [ player( "a" ), player( "b" ) ];

const info = ( id: Player, isBot = false ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar", isBot } );

/** How long the engine waits before the policy plays a seat. */
const BOT_DELAY_MS = 5_000;

/** What a table plays to, when a test does not care which. */
type WinningPoints = typeof SPLENDOR_WINNING_POINTS[number];

const configFor = (
	playerCount: 2 | 3 | 4,
	winningPoints: WinningPoints = SPLENDOR_DEFAULT_WINNING_POINTS
): SplendorConfig => ( {
	playerCount,
	winningPoints,
	autoStart: false,
	moveTimeoutMillis: SPLENDOR_MOVE_TIMEOUT_MILLIS
} );

/**
 * Seats a table by hand and starts it, which is how Splendor runs: `autoStart`
 * is off, so the creator says when the lobby closes.
 *
 * @param body - What to play once the game is under way.
 * @param [options] - The seat count, who is a bot, and the clock to drive it with.
 * @returns The run's result and collectors.
 */
const table = <A, E>(
	body: ( engine: Effect.Success<typeof splendor> ) => Effect.Effect<A, E>,
	options: {
		readonly seats?: ReadonlyArray<Player>;
		readonly bots?: ReadonlyArray<Player>;
		readonly clock?: ReturnType<typeof testClock>;
		readonly winningPoints?: WinningPoints;
	} = {}
) => {
	const seats = options.seats ?? [ a, b ];
	const clock = options.clock ?? testClock();
	const config = configFor( seats.length as 2 | 3 | 4, options.winningPoints );

	return runGame( splendor, engine => Effect.gen( function* () {
		yield* engine.initialize( createInput( config, seats[ 0 ]! ) );
		for ( const seat of seats ) {
			yield* engine.join( info( seat, options.bots?.includes( seat ) ?? false ) );
		}

		yield* engine.start( seats[ 0 ]! );
		return yield* body( engine );
	} ), { now: clock.now } );
};

/** The view a seat holds right now. */
const viewOf = ( engine: Effect.Success<typeof splendor>, id?: Player ) =>
	( id ? engine.getState( id ) : engine.getState() ).pipe(
		Effect.map( envelope => envelope.view as SplendorView )
	);

/** A `pickTokens` input taking one of each named gem. */
const take = ( ...gems: ReadonlyArray<string> ): PickTokensInput =>
	( { tokens: Object.fromEntries( gems.map( gem => [ gem, 1 ] ) ) } );

/** Plays whatever the policy would play for the seat whose turn it is. */
const policyMove = ( engine: Effect.Success<typeof splendor> ) => Effect.gen( function* () {
	const envelope = yield* engine.getState();
	const [ frame ] = envelope.context.interactions.slice( -1 );
	const seat = frame
		? frame.responders.find( id => !( id in frame.responses ) )!
		: envelope.context.currentPlayer;

	const view = ( yield* engine.getState( seat ) ).view as SplendorView;
	const move = decideMove( view, envelope.context )!;

	switch ( move.moveType ) {
		case "pickTokens":
			return yield* engine.pickTokens( move.input, seat );
		case "reserveCard":
			return yield* engine.reserveCard( move.input, seat );
		case "purchaseCard":
			return yield* engine.purchaseCard( move.input, seat );
		case "claimNoble":
			return yield* engine.claimNoble( move.input, seat );
	}
} );


describe( "dealing the table", () => {
	test( "sizes the bank to the seat count and always deals five gold", () => {
		for ( const seats of [ [ a, b ], [ a, b, player( "c" ) ] ] as const ) {
			const { result } = table( engine => viewOf( engine ), { seats } );
			const supply = SPLENDOR_TOKEN_SUPPLY[ seats.length as 2 | 3 ];

			expect( result.tokens ).toEqual( {
				diamond: supply,
				sapphire: supply,
				emerald: supply,
				ruby: supply,
				onyx: supply,
				gold: SPLENDOR_GOLD_SUPPLY
			} );
		}
	} );

	test( "turns up four cards of each level and keeps the rest face down", () => {
		const { result } = table( engine => viewOf( engine ) );

		expect( result.cards[ 1 ] ).toHaveLength( SPLENDOR_OPEN_CARDS );
		expect( result.cards[ 2 ] ).toHaveLength( SPLENDOR_OPEN_CARDS );
		expect( result.cards[ 3 ] ).toHaveLength( SPLENDOR_OPEN_CARDS );
		expect( result.deckCounts ).toEqual( { 1: 36, 2: 26, 3: 16 } );
	} );

	test( "draws one more noble than there are seats", () => {
		const { result } = table( engine => viewOf( engine ) );
		expect( result.nobles ).toHaveLength( 3 );
	} );

	test( "seats everyone empty-handed", () => {
		const { result } = table( engine => viewOf( engine ) );

		for ( const seat of [ a, b ] ) {
			expect( result.playerData[ seat ] ).toMatchObject( {
				cards: [],
				nobles: [],
				reserved: [],
				points: 0
			} );
			expect( sumTokens( result.playerData[ seat ]!.tokens ) ).toBe( 0 );
		}
	} );

	test( "never puts the deck order on the wire", () => {
		const { result } = table( engine => viewOf( engine, a ) );
		expect( result ).not.toHaveProperty( "decks" );
	} );

	test( "shows every seat the same table, itself included", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.reserveCard( {
				cardId: ( yield* viewOf( engine, a ) ).cards[ 1 ][ 0 ]!.id,
				withGold: true
			}, a );

			return {
				own: yield* viewOf( engine, a ),
				opponent: yield* viewOf( engine, b ),
				spectator: yield* viewOf( engine )
			};
		} ) );

		const { own, opponent, spectator } = result;

		// Nothing about a seat is private — the reservation came off the board face
		// up — so the three views differ only in whose seat they were built for.
		expect( opponent.playerData ).toEqual( own.playerData );
		expect( spectator.playerData ).toEqual( own.playerData );
		expect( own.playerId ).toBe( a );
		expect( opponent.playerId ).toBe( b );
		expect( spectator.playerId ).toBeUndefined();
	} );
} );


describe( "taking gems", () => {
	test( "moves three different gems from the bank to the seat", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.pickTokens( take( "diamond", "sapphire", "emerald" ), a );
			return yield* viewOf( engine, a );
		} ) );

		expect( result.tokens ).toMatchObject( { diamond: 3, sapphire: 3, emerald: 3, ruby: 4 } );
		expect( result.playerData[ a ]!.tokens ).toMatchObject( {
			diamond: 1,
			sapphire: 1,
			emerald: 1
		} );
	} );

	test( "hands the turn to the next seat", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.pickTokens( take( "diamond", "sapphire", "emerald" ), a );
			return yield* engine.getState();
		} ) );

		expect( result.context.currentPlayer ).toBe( b );
		expect( result.context.turn ).toBe( 1 );
	} );

	test( "refuses gold, which is only ever taken with a reservation", () => {
		const { result } = table( engine =>
			engine.pickTokens( { tokens: { gold: 1 } }, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a negative take at the decode boundary", () => {
		// A negative entry never reaches the rules: `sumTokens` would read it as a
		// credit and wave the ten-token discard through, so the schema stops it.
		const { result } = table( engine =>
			engine.pickTokens( { tokens: { diamond: 1, sapphire: -5 } }, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as InvalidMove ).reason )
			.not.toBe( "Take three different gems, or two of the same!" );
	} );

	test( "refuses a fractional take at the decode boundary", () => {
		const { result } = table( engine =>
			engine.pickTokens( { tokens: { diamond: 1.5 } }, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "allows two of a kind only off a pile of four or more", () => {
		const { result } = table( engine => Effect.gen( function* () {
			// The two-seat bank holds exactly four, so the first double is legal and
			// the second — against the two left — is not.
			yield* engine.pickTokens( { tokens: { diamond: 2 } }, a );
			yield* engine.pickTokens( take( "ruby", "onyx", "emerald" ), b );

			return yield* engine.pickTokens( { tokens: { diamond: 2 } }, a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "insists on three different gems while three are still there", () => {
		const { result } = table( engine =>
			engine.pickTokens( take( "diamond" ), a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a take of nothing", () => {
		const { result } = table( engine =>
			engine.pickTokens( { tokens: {} }, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a mix that is neither three different nor two alike", () => {
		const { result } = table( engine =>
			engine.pickTokens( { tokens: { diamond: 2, sapphire: 1 } }, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses to take more than the bank holds", () => {
		const { result } = table( engine => Effect.gen( function* () {
			// Two seats plus a double empties a four-token pile.
			yield* engine.pickTokens( { tokens: { diamond: 2 } }, a );
			yield* engine.pickTokens( take( "diamond", "sapphire", "emerald" ), b );
			yield* engine.pickTokens( take( "diamond", "ruby", "onyx" ), a );

			return yield* engine.pickTokens( take( "diamond", "sapphire", "emerald" ), b )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "asks for every type left once fewer than three remain", () => {
		const { result } = table( engine => Effect.gen( function* () {
			// Drains the diamond, sapphire and emerald piles between the two seats,
			// which leaves only two types on the table.
			yield* engine.pickTokens( { tokens: { diamond: 2 } }, a );
			yield* engine.pickTokens( { tokens: { sapphire: 2 } }, b );
			yield* engine.pickTokens( { tokens: { emerald: 2 } }, a );
			yield* engine.pickTokens( take( "diamond", "sapphire", "emerald" ), b );
			yield* engine.pickTokens( take( "diamond", "sapphire", "emerald" ), a );

			const refused = yield* engine.pickTokens( take( "ruby" ), b ).pipe( Effect.flip );
			yield* engine.pickTokens( take( "ruby", "onyx" ), b );

			return { refused, view: yield* viewOf( engine, b ) };
		} ) );

		expect( result.view.tokens ).toMatchObject( { diamond: 0, sapphire: 0, emerald: 0 } );
		expect( result.refused._tag ).toBe( "swish/InvalidMove" );
		expect( result.view.playerData[ b ]!.tokens ).toMatchObject( { ruby: 1, onyx: 1 } );
	} );
} );


describe( "the ten-token limit", () => {
	/**
	 * Walks `a` up to nine gems while `b` banks third-row cards instead of gems,
	 * so every pile still has something in it when the limit finally bites.
	 */
	const nearTheLimit = <A, E>(
		body: ( engine: Effect.Success<typeof splendor> ) => Effect.Effect<A, E>
	) => table( engine => Effect.gen( function* () {
		for ( let round = 0; round < 3; round++ ) {
			yield* engine.pickTokens( take( "diamond", "sapphire", "emerald" ), a );

			const view = yield* viewOf( engine, b );
			yield* engine.reserveCard( { cardId: view.cards[ 3 ][ round ]!.id, withGold: true }, b );
		}

		return yield* body( engine );
	} ) );

	test( "leaves a seat at nine holding nine", () => {
		const { result } = nearTheLimit( engine => viewOf( engine, a ) );
		expect( sumTokens( result.playerData[ a ]!.tokens ) ).toBe( 9 );
	} );

	test( "refuses a take that would carry a seat past ten", () => {
		const { result } = nearTheLimit( engine =>
			engine.pickTokens( take( "ruby", "onyx", "diamond" ), a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "accepts the same take with the excess handed back", () => {
		const { result } = nearTheLimit( engine => Effect.gen( function* () {
			yield* engine.pickTokens( {
				tokens: { ruby: 1, onyx: 1, diamond: 1 },
				returned: { sapphire: 1, emerald: 1 }
			}, a );

			return yield* viewOf( engine, a );
		} ) );

		expect( sumTokens( result.playerData[ a ]!.tokens ) ).toBe( 10 );
		expect( result.playerData[ a ]!.tokens ).toMatchObject( { sapphire: 2, emerald: 2, ruby: 1 } );
	} );

	test( "refuses a hand-back the seat does not hold", () => {
		const { result } = nearTheLimit( engine => engine.pickTokens( {
			tokens: { ruby: 1, onyx: 1, diamond: 1 },
			returned: { gold: 2 }
		}, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a hand-back when the seat is not over the limit", () => {
		const { result } = table( engine => engine.pickTokens( {
			tokens: { diamond: 1, sapphire: 1, emerald: 1 },
			returned: { diamond: 1 }
		}, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );
} );


describe( "reserving a card", () => {
	test( "takes the card off the board, turns up its replacement and pays a gold", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const before = yield* viewOf( engine, a );
			const target = before.cards[ 1 ][ 0 ]!;

			yield* engine.reserveCard( { cardId: target.id, withGold: true }, a );

			return { target, after: yield* viewOf( engine, a ) };
		} ) );

		const { target, after } = result;

		expect( after.cards[ 1 ] ).toHaveLength( SPLENDOR_OPEN_CARDS );
		expect( after.cards[ 1 ].map( c => c.id ) ).not.toContain( target.id );
		expect( after.deckCounts[ 1 ] ).toBe( 35 );
		expect( after.playerData[ a ]!.reserved.map( c => c.id ) ).toEqual( [ target.id ] );
		expect( after.playerData[ a ]!.tokens.gold ).toBe( 1 );
		expect( after.tokens.gold ).toBe( SPLENDOR_GOLD_SUPPLY - 1 );
	} );

	test( "leaves the gold alone when the seat says so", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const target = ( yield* viewOf( engine, a ) ).cards[ 2 ][ 0 ]!;
			yield* engine.reserveCard( { cardId: target.id, withGold: false }, a );

			return yield* viewOf( engine, a );
		} ) );

		expect( result.playerData[ a ]!.tokens.gold ).toBe( 0 );
		expect( result.tokens.gold ).toBe( SPLENDOR_GOLD_SUPPLY );
	} );

	test( "refuses a fourth card in reserve", () => {
		const { result } = table( engine => Effect.gen( function* () {
			for ( let i = 0; i < 3; i++ ) {
				const view = yield* viewOf( engine, a );
				yield* engine.reserveCard( { cardId: view.cards[ 3 ][ 0 ]!.id, withGold: false }, a );
				yield* engine.pickTokens( take( "ruby", "onyx", "emerald" ), b );
			}

			const view = yield* viewOf( engine, a );
			return yield* engine.reserveCard( { cardId: view.cards[ 3 ][ 0 ]!.id, withGold: false }, a )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a card that is not on the board", () => {
		const { result } = table( engine =>
			engine.reserveCard( { cardId: "no-such-card", withGold: false }, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a card another seat already reserved", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const target = ( yield* viewOf( engine, a ) ).cards[ 1 ][ 0 ]!;
			yield* engine.reserveCard( { cardId: target.id, withGold: false }, a );

			return yield* engine.reserveCard( { cardId: target.id, withGold: false }, b )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );
} );


describe( "buying a card", () => {
	/** The cheapest card face up on the first row — what a fresh seat can reach. */
	const cheapest = ( view: SplendorView ) =>
		view.cards[ 1 ].toSorted( ( x, y ) => sumTokens( x.cost ) - sumTokens( y.cost ) )[ 0 ]!;

	/**
	 * Keeps the turn moving for `b` without disturbing what `a` is saving for. A
	 * third-row reservation costs no gems and cannot touch a first-row target, so
	 * that is the first choice; once `b` is holding three, it takes the gems the
	 * target asks least for instead.
	 */
	const filler = ( engine: Effect.Success<typeof splendor>, target: Card ) =>
		Effect.gen( function* () {
			const view = yield* viewOf( engine, b );

			if ( view.playerData[ b ]!.reserved.length < SPLENDOR_MAX_RESERVED ) {
				return yield* engine.reserveCard(
					{ cardId: view.cards[ 3 ][ 0 ]!.id, withGold: false },
					b
				);
			}

			const picked = GEMS.filter( gem => view.tokens[ gem ] > 0 )
				.toSorted( ( x, y ) => target.cost[ x ] - target.cost[ y ] )
				.slice( 0, 3 );

			return yield* engine.pickTokens(
				{ tokens: Object.fromEntries( picked.map( gem => [ gem, 1 ] ) ) },
				b
			);
		} );

	/**
	 * Walks `a` up to paying for one card, taking the gems that card still asks
	 * for ahead of any others. Three rounds is enough for any first-row card and
	 * leaves `a` at nine tokens, so the ten-token discard never enters into it.
	 */
	const fund = ( engine: Effect.Success<typeof splendor>, target: Card ) =>
		Effect.gen( function* () {
			for ( let round = 0; round < 3; round++ ) {
				const view = yield* viewOf( engine, a );
				const me = view.playerData[ a ]!;
				const paid = paymentFor( target, me.tokens, me.cards );
				if ( paid ) {
					return paid;
				}

				const cost = discountedCost( target, me.cards );
				const available = GEMS.filter( gem => view.tokens[ gem ] > 0 );
				const wanted = available.filter( gem => cost[ gem ] > me.tokens[ gem ] );

				// Two of a kind whenever the card wants two more of one gem and the
				// pile can stand it; three different otherwise.
				const double = wanted.find(
					gem => cost[ gem ] - me.tokens[ gem ] >= 2 && view.tokens[ gem ] >= 4
				);

				const picked = [ ...wanted, ...available.filter( gem => !wanted.includes( gem ) ) ]
					.slice( 0, Math.min( 3, available.length ) );

				yield* engine.pickTokens(
					double
						? { tokens: { [ double ]: 2 } }
						: { tokens: Object.fromEntries( picked.map( gem => [ gem, 1 ] ) ) },
					a
				);
				yield* filler( engine, target );
			}

			const view = yield* viewOf( engine, a );
			const me = view.playerData[ a ]!;
			return paymentFor( target, me.tokens, me.cards );
		} );

	test( "pays the bank, keeps the card and turns up its replacement", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const target = cheapest( yield* viewOf( engine, a ) );
			const payment = yield* fund( engine, target );

			const before = yield* viewOf( engine, a );
			yield* engine.purchaseCard( { cardId: target.id, payment: payment! }, a );

			return { target, payment: payment!, before, after: yield* viewOf( engine, a ) };
		} ) );

		const { target, payment, before, after } = result;

		expect( after.playerData[ a ]!.cards.map( c => c.id ) ).toEqual( [ target.id ] );
		expect( after.playerData[ a ]!.points ).toBe( target.points );
		expect( after.cards[ 1 ].map( c => c.id ) ).not.toContain( target.id );
		expect( after.cards[ 1 ] ).toHaveLength( SPLENDOR_OPEN_CARDS );
		expect( after.deckCounts[ 1 ] ).toBe( before.deckCounts[ 1 ] - 1 );

		// Every token spent goes back to the bank, none of it anywhere else.
		expect( sumTokens( after.playerData[ a ]!.tokens ) )
			.toBe( sumTokens( before.playerData[ a ]!.tokens ) - sumTokens( payment ) );
		expect( sumTokens( after.tokens ) ).toBe( sumTokens( before.tokens ) + sumTokens( payment ) );
	} );

	test( "discounts the next card by the bonus the first one left behind", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const target = cheapest( yield* viewOf( engine, a ) );
			const payment = yield* fund( engine, target );
			yield* engine.purchaseCard( { cardId: target.id, payment: payment! }, a );

			const after = yield* viewOf( engine, a );
			const priced = { ...target, cost: { ...target.cost, [ target.bonus ]: 2 } };

			return {
				bonus: target.bonus,
				discounted: discountedCost( priced, after.playerData[ a ]!.cards )
			};
		} ) );

		// One card bought, so the gem it prints comes off the next card's price.
		expect( result.discounted[ result.bonus ] ).toBe( 1 );
	} );

	test( "buys a card out of the seat's own reserve", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const target = cheapest( yield* viewOf( engine, a ) );

			yield* engine.reserveCard( { cardId: target.id, withGold: false }, a );
			yield* filler( engine, target );

			const payment = yield* fund( engine, target );
			const before = yield* viewOf( engine, a );
			yield* engine.purchaseCard( { cardId: target.id, payment: payment! }, a );

			return { target, before, after: yield* viewOf( engine, a ) };
		} ) );

		const { target, before, after } = result;

		expect( before.playerData[ a ]!.reserved ).toHaveLength( 1 );
		expect( after.playerData[ a ]!.reserved ).toHaveLength( 0 );
		expect( after.playerData[ a ]!.cards.map( c => c.id ) ).toEqual( [ target.id ] );

		// Nothing is turned up: the card left the board when it was reserved.
		expect( after.deckCounts[ 1 ] ).toBe( before.deckCounts[ 1 ] );
	} );

	test( "refuses a payment that leaves the cost short", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const target = cheapest( yield* viewOf( engine, a ) );
			return yield* engine.purchaseCard( { cardId: target.id, payment: {} }, a )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses an overpayment in gold", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const target = cheapest( yield* viewOf( engine, a ) );
			const payment = yield* fund( engine, target );

			return yield* engine.purchaseCard(
				{ cardId: target.id, payment: { ...payment, gold: ( payment!.gold ?? 0 ) + 1 } },
				a
			).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a card the seat neither sees nor holds", () => {
		const { result } = table( engine =>
			engine.purchaseCard( { cardId: "no-such-card", payment: {} }, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses tokens the seat does not have", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const target = cheapest( yield* viewOf( engine, a ) );
			const payment = paymentFor( target, {
				diamond: 9, sapphire: 9, emerald: 9, ruby: 9, onyx: 9, gold: 9
			}, [] )!;

			return yield* engine.purchaseCard( { cardId: target.id, payment }, a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses another seat's reserved card", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const target = cheapest( yield* viewOf( engine, a ) );
			yield* engine.reserveCard( { cardId: target.id, withGold: false }, a );

			const payment = paymentFor(
				target, { diamond: 9, sapphire: 9, emerald: 9, ruby: 9, onyx: 9, gold: 9 },
				[]
			)!;

			return yield* engine.purchaseCard( { cardId: target.id, payment }, b ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );
} );


describe( "the noble visit", () => {
	/** A full table: five nobles on it, so two often want the same seat at once. */
	const NOBLE_SEATS = [ a, b, player( "c" ), player( "d" ) ] as const;

	/** Long enough to cover the tail of the hunt below, which is not a fixed cost. */
	const HUNT_TIMEOUT_MS = 60_000;

	/**
	 * Plays bot tables until a purchase leaves its buyer choosing between nobles,
	 * then hands the game over with that frame still open.
	 *
	 * A choice needs two nobles willing to visit the same seat at the same moment,
	 * which turns on the cards the shuffle deals — so this hunts for one across
	 * whole games rather than trying to script it. About one table in four
	 * produces one, which makes an empty run of this many astronomically unlikely;
	 * it throws rather than passing vacuously if it ever happens.
	 *
	 * Hunting is why the three tests below carry their own timeout: a table is
	 * cheap but the number of them needed varies, and the default five seconds is
	 * inside the spread rather than outside it.
	 *
	 * @param body - What to assert against the paused table, given the clock it
	 * 		is running on so it can let the frame's own timers fire.
	 * @returns Whatever the body returned.
	 */
	const atNobleChoice = <A, E>(
		body: (
			engine: Effect.Success<typeof splendor>,
			frame: InteractionFrame,
			clock: ReturnType<typeof testClock>
		) => Effect.Effect<A, E>
	) => {
		for ( let attempt = 0; attempt < 100; attempt++ ) {
			const clock = testClock();

			const { result } = table( engine => Effect.gen( function* () {
				for ( let tick = 0; tick < 1200; tick++ ) {
					const state = yield* engine.getState();
					if ( state.status === "COMPLETED" ) {
						return undefined;
					}

					const [ frame ] = state.context.interactions.slice( -1 );
					if ( frame?.kind === SPLENDOR_NOBLE_VISIT ) {
						return { value: yield* body( engine, frame, clock ) };
					}

					clock.advance( BOT_DELAY_MS + 1 );
					yield* engine.alarm();
				}

				return undefined;
			} ), { seats: NOBLE_SEATS, bots: NOBLE_SEATS, clock } );

			if ( result ) {
				return result.value;
			}
		}

		throw new Error( "no table produced a choice of nobles" );
	};

	// One paused table, several questions — none of these commit, since a refused
	// move is discarded whole, so the frame is still open for the next of them.
	test( "opens a frame on the buyer alone and holds the table there", () => {
		const result = atNobleChoice( ( engine, frame ) => Effect.gen( function* () {
			const offered = frame.payload as ReadonlyArray<string>;
			const state = yield* engine.getState();
			const other = state.context.players.find( id => id !== frame.initiator )!;

			return {
				frame,
				offered,
				view: ( yield* engine.getState( frame.initiator ) ).view as SplendorView,

				// Anything but a response is refused outright...
				otherMove: yield* engine
					.pickTokens( take( "diamond", "sapphire", "emerald" ), frame.initiator )
					.pipe( Effect.flip ),

				// ...a response from anyone but the buyer is not their turn to make...
				otherSeat: yield* engine
					.claimNoble( { nobleId: offered[ 0 ]! }, other )
					.pipe( Effect.flip ),

				// ...and a noble that is not on offer is refused on the rules.
				wrongNoble: yield* engine
					.claimNoble( { nobleId: "no-such-noble" }, frame.initiator )
					.pipe( Effect.flip )
			};
		} ) );

		const { frame, offered, view, otherMove, otherSeat, wrongNoble } = result;

		expect( frame.responders ).toEqual( [ frame.initiator ] );
		expect( frame.responses ).toEqual( {} );
		expect( offered.length ).toBeGreaterThanOrEqual( 2 );
		expect( frame.deadline ).toBeDefined();

		// The card is already the buyer's — only the noble is still pending.
		expect( view.nobles.map( n => n.id ) ).toEqual( expect.arrayContaining( [ ...offered ] ) );

		expect( otherMove._tag ).toBe( "swish/MoveNotAllowed" );
		expect( otherSeat._tag ).toBe( "swish/NotYourTurn" );
		expect( wrongNoble._tag ).toBe( "swish/InvalidMove" );
	}, HUNT_TIMEOUT_MS );

	test( "sends in the one the buyer named, and only that one", () => {
		const result = atNobleChoice( ( engine, frame ) => Effect.gen( function* () {
			const before = ( yield* engine.getState( frame.initiator ) ).view as SplendorView;
			const offered = frame.payload as ReadonlyArray<string>;

			// The second, so a resolution that just took the first would show up.
			const chosen = offered[ 1 ]!;
			yield* engine.claimNoble( { nobleId: chosen }, frame.initiator ).pipe( Effect.orDie );

			return {
				chosen,
				seat: frame.initiator,
				before,
				after: yield* engine.getState( frame.initiator )
			};
		} ) );

		const { chosen, seat, before, after } = result;
		const view = after.view as SplendorView;
		const held = view.playerData[ seat ]!;
		const had = before.playerData[ seat ]!;

		// Exactly one noble more than before, and it is the one that was named —
		// a seat may have been visited on an earlier turn, so the delta is the test.
		expect( held.nobles.map( n => n.id ) )
			.toEqual( [ ...had.nobles.map( n => n.id ), chosen ] );
		expect( held.points ).toBe( had.points + 3 );
		expect( view.nobles.map( n => n.id ) ).not.toContain( chosen );

		// The frame is gone and the turn has moved on.
		expect( after.context.interactions ).toEqual( [] );
		expect( after.context.currentPlayer ).not.toBe( seat );
	}, HUNT_TIMEOUT_MS );

	test( "settles itself when the buyer never answers", () => {
		const result = atNobleChoice( ( engine, frame, clock ) => Effect.gen( function* () {
			const before = ( yield* engine.getState( frame.initiator ) ).view as SplendorView;

			// The seat is machine-played, so the alarm the frame is waiting on hands
			// it to the policy — which answers rather than leaving the table stuck.
			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();

			return { seat: frame.initiator, before, after: yield* engine.getState( frame.initiator ) };
		} ) );

		const { seat, before, after } = result;
		const view = after.view as SplendorView;

		expect( after.context.interactions ).toEqual( [] );
		expect( view.playerData[ seat ]!.nobles )
			.toHaveLength( before.playerData[ seat ]!.nobles.length + 1 );
	}, HUNT_TIMEOUT_MS );

	test( "refuses a claim with no noble waiting", () => {
		const { result } = table( engine =>
			engine.claimNoble( { nobleId: "anything" }, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as InvalidMove ).reason ).toBe( "No noble is waiting on you!" );
	} );
} );


describe( "passing a turn", () => {
	/**
	 * A seat with nothing to do: the bank holds only gold, the board is bare and
	 * the three cards it is holding cost more than it owns.
	 *
	 * A live table cannot be walked into this position — every gem would have to
	 * be in somebody's hand at once, and a seat holding that many can always buy
	 * something — so the rule itself is covered by `hasLegalMove`'s own tests and
	 * this is what the policy is shown.
	 */
	const stuck = ( over: Partial<SplendorView> = {} ) => ( {
		tokens: { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 5 },
		cards: { 1: [], 2: [], 3: [] },
		nobles: [],
		deckCounts: { 1: 0, 2: 0, 3: 0 },
		playerData: {
			[ a ]: {
				tokens: { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 },
				cards: [],
				nobles: [],
				reserved: [ 1, 2, 3 ].map( n => ( {
					id: `dear-${ n }`,
					level: 3 as const,
					points: 5,
					cost: { diamond: 7, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 },
					bonus: "onyx" as const
				} ) ),
				points: 0
			}
		},
		playerId: a,
		...over
	} );

	/** A context with nothing pending, which is what a normal turn looks like. */
	const openTurn = {
		_tag: "swish/GameContext" as const,
		turn: 4,
		players: [ a, b ],
		currentPlayer: a,
		interactions: [],
		seats: {},
		teams: {},
		teamNames: {}
	};

	test( "is refused while the seat still has a move to make", () => {
		const { result } = table( engine => engine.pass( {}, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as InvalidMove ).reason ).toBe( "You still have a move to make!" );
	} );

	test( "is refused out of turn", () => {
		const { result } = table( engine => engine.pass( {}, b ).pipe( Effect.flip ) );
		expect( result._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "is what the policy plays when the rules leave it nothing else", () => {
		expect( decideMove( stuck(), openTurn ) ).toEqual( { moveType: "pass", input: {} } );
	} );

	test( "is not what the policy plays while a gem is left in the bank", () => {
		const view = stuck( {
			tokens: { diamond: 1, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 5 }
		} );

		expect( decideMove( view, openTurn )?.moveType ).toBe( "pickTokens" );
	} );

	test( "is not what the policy plays while there is a card to reserve", () => {
		const cheap = {
			id: "cheap",
			level: 1 as const,
			points: 0,
			cost: { diamond: 1, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 },
			bonus: "ruby" as const
		};

		const base = stuck();
		const view = stuck( {
			cards: { 1: [ cheap ], 2: [], 3: [] },
			playerData: { [ a ]: { ...base.playerData[ a ]!, reserved: [] } }
		} );

		expect( decideMove( view, openTurn )?.moveType ).toBe( "reserveCard" );
	} );
} );


describe( "a table played by the policy", () => {
	/**
	 * Runs both seats through the policy until the game is over, noting the best
	 * score standing at each round boundary the table played *through*. A boundary
	 * only gets recorded while the game is still going, so the list is every round
	 * that did not end it.
	 */
	const playOut = (
		clock: ReturnType<typeof testClock>,
		winningPoints?: WinningPoints
	) => table( engine => Effect.gen( function* () {
		// Both seats to the machine: `b` is a bot outright, `a` hands its seat over.
		yield* engine.setAutoPlay( a, true );
		const boundaries: Array<number> = [];

		for ( let tick = 0; tick < 800; tick++ ) {
			const state = yield* engine.getState();
			if ( state.status === "COMPLETED" ) {
				return { state, boundaries };
			}

			const { turn, players } = state.context;
			if ( turn > 0 && turn % players.length === 0 ) {
				const view = state.view as SplendorView;
				boundaries.push(
					Math.max( ...players.map( id => view.playerData[ id ]?.points ?? 0 ) )
				);
			}

			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();
		}

		return { state: yield* engine.getState(), boundaries };
	} ), { bots: [ b ], clock, winningPoints } );

	test( "runs to a finish with a legal move every turn", () => {
		const { result, saved } = playOut( testClock() );

		expect( result.state.status ).toBe( "COMPLETED" );
		expect( result.state.results?.ranking ).toHaveLength( 2 );
		expect( result.state.context.interactions ).toEqual( [] );
		expect( saved.size ).toBe( 1 );
	} );

	test( "ends only on a round boundary, so both seats have had the same turns", () => {
		const { result } = playOut( testClock() );

		expect( result.state.context.turn % 2 ).toBe( 0 );

		const scores = result.state.results!.ranking.map( r => r.score ?? 0 );
		expect( Math.max( ...scores ) ).toBeGreaterThanOrEqual( SPLENDOR_DEFAULT_WINNING_POINTS );
	} );

	test( "keeps every seat's prestige equal to the cards and nobles it holds", () => {
		const { result } = playOut( testClock() );
		const view = result.state.view as SplendorView;

		for ( const seat of [ a, b ] ) {
			const held = view.playerData[ seat ]!;
			const earned = held.cards.reduce( ( total, card ) => total + card.points, 0 )
				+ held.nobles.reduce( ( total, noble ) => total + noble.points, 0 );

			expect( held.points ).toBe( earned );
		}
	} );

	test( "takes every claimed noble off the table exactly once", () => {
		const { result } = playOut( testClock() );
		const view = result.state.view as SplendorView;

		const claimed = [ a, b ].flatMap( seat => view.playerData[ seat ]!.nobles.map( n => n.id ) );

		expect( new Set( claimed ).size ).toBe( claimed.length );
		expect( view.nobles.map( n => n.id ).filter( id => claimed.includes( id ) ) ).toEqual( [] );
		expect( view.nobles.length + claimed.length ).toBe( 3 );
	} );

	for ( const winningPoints of SPLENDOR_WINNING_POINTS ) {
		test( `plays to the ${ winningPoints } it was created with`, () => {
			const { result } = playOut( testClock(), winningPoints );
			const { state, boundaries } = result;

			expect( state.status ).toBe( "COMPLETED" );
			expect( state.config.winningPoints ).toBe( winningPoints );

			const scores = state.results!.ranking.map( r => r.score ?? 0 );
			expect( Math.max( ...scores ) ).toBeGreaterThanOrEqual( winningPoints );

			// Every round the table played *through* left everyone short of the
			// target — so the round that ended it is the first one to reach it. A
			// target the engine ignored would show up here as a boundary it played
			// straight past.
			expect( boundaries.every( best => best < winningPoints ) ).toBe( true );
		} );
	}

	test( "plays a seat that hands itself over", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.setAutoPlay( a, true );
			return yield* engine.getState();
		} ) );

		expect( result.autoPlay[ a ] ).toBe( true );
	} );

	test( "picks a move for the seat whose turn it is, by hand too", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* policyMove( engine );
			return yield* engine.getState();
		} ) );

		expect( result.context.turn ).toBe( 1 );
		expect( result.context.currentPlayer ).toBe( b );
	} );
} );
