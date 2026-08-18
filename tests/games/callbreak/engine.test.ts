import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { callbreak } from "@/games/callbreak/server/engine.ts";
import {
	CALLBREAK_DEAL_COUNTS,
	CALLBREAK_MOVE_TIMEOUT_MILLIS,
	CALLBREAK_PLAYER_COUNT,
	CALLBREAK_TRICKS_PER_DEAL
} from "@/games/callbreak/shared/schema.ts";
import { calculateRoundScore, determineTrickWinner } from "@/games/callbreak/server/utils.ts";
import { getPlayableCards } from "@/games/callbreak/shared/utils.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { createInput, runGame, testClock } from "@tests/helpers/runner.ts";

import type {
	CallbreakConfig,
	CallbreakView,
	Trick
} from "@/games/callbreak/shared/schema.ts";
import type { CardId, CardSuit } from "@/shared/cards/schema.ts";
import type { InvalidMove, PlayerId as Player } from "@/swish/shared/schema.ts";

type Engine = Effect.Success<typeof callbreak>;

/** How long the engine waits before the policy plays a seat. */
const BOT_DELAY_MS = 5_000;

const seat = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d ] = [ seat( "a" ), seat( "b" ), seat( "c" ), seat( "d" ) ];

const seats: ReadonlyArray<Player> = [ a, b, c, d ];

const info = ( id: Player, isBot = false ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar", isBot } );

const configFor = (
	dealCount: typeof CALLBREAK_DEAL_COUNTS[number],
	trumpSuit: CardSuit
): CallbreakConfig => ( {
	playerCount: CALLBREAK_PLAYER_COUNT,
	dealCount,
	trumpSuit,
	autoStart: false,
	moveTimeoutMillis: CALLBREAK_MOVE_TIMEOUT_MILLIS
} );

/**
 * Seats four players by hand and starts the table, which is how Callbreak runs:
 * `autoStart` is off, so the creator says when the lobby closes.
 *
 * @param body - What to play once the game is under way.
 * @param [options] - The round shape, who is a bot, and the clock to drive it with.
 * @returns The run's result and collectors.
 */
const table = <A, E>(
	body: ( engine: Engine ) => Effect.Effect<A, E>,
	options: {
		readonly dealCount?: typeof CALLBREAK_DEAL_COUNTS[number];
		readonly trumpSuit?: CardSuit;
		readonly bots?: boolean;
		readonly clock?: ReturnType<typeof testClock>;
	} = {}
) => {
	const clock = options.clock ?? testClock();
	const config = configFor( options.dealCount ?? 5, options.trumpSuit ?? "S" );

	return runGame( callbreak, engine => Effect.gen( function* () {
		yield* engine.initialize( createInput( config, a ) );

		for ( const player of seats ) {
			yield* engine.join( info( player, options.bots ?? false ) );
		}

		yield* engine.start( a );
		return yield* body( engine );
	} ), { now: clock.now } );
};

/** The envelope a seat (or a spectator) reads right now. */
const envelopeOf = ( engine: Engine, id?: Player ) =>
	id ? engine.getState( id ) : engine.getState();

/** The view a seat (or a spectator) holds right now. */
const viewOf = ( engine: Engine, id?: Player ) =>
	envelopeOf( engine, id ).pipe( Effect.map( envelope => envelope.view as CallbreakView ) );

/**
 * The trick the next card goes into. A settled trick stays the newest one until
 * its winner leads again — the engine opens the next one in `beforeMove` — so a
 * client works its legal cards out against an empty trick of its own, exactly as
 * the bot policy does.
 *
 * @param view - The acting seat's view.
 * @param playerId - The seat about to play.
 * @returns The trick to measure the hand against.
 */
const trickInPlay = ( view: CallbreakView, playerId: Player ) => {
	const current = view.activeDeal?.tricks[ 0 ];
	const settled = !current
		|| !!current.winner
		|| Object.keys( current.cards ).length >= CALLBREAK_PLAYER_COUNT;

	return settled ? ( { leadPlayer: playerId, cards: {} } as Trick ) : current;
};

/** Every card the acting seat may legally play, in hand order. */
const legalCards = ( view: CallbreakView, trump: CardSuit, playerId: Player ) =>
	getPlayableCards( view.hand, trump, trickInPlay( view, playerId ) );

/** Hands the call round to each seat in turn, declaring the same number each. */
const declareAll = ( engine: Engine, wins = 1 ) => Effect.gen( function* () {
	for ( let i = 0; i < CALLBREAK_PLAYER_COUNT; i++ ) {
		const envelope = yield* envelopeOf( engine );
		const actor = envelope.context.currentPlayer;
		const view = yield* viewOf( engine, actor );

		yield* engine.declareWins( { wins, dealId: view.activeDeal!.id }, actor );
	}
} );

/**
 * Plays one trick out, always choosing the first legal card. Rebuilds the trick
 * as it goes so the caller knows who took it without having to read a view that
 * may already have moved on to the next deal.
 *
 * @param engine - The game to play.
 * @param trump - The table's trump suit.
 * @returns Who led it, what was played, and who took it.
 */
const playTrick = ( engine: Engine, trump: CardSuit ) => Effect.gen( function* () {
	const cards: Record<Player, CardId> = {};
	let leadPlayer: Player | undefined;
	let suit: CardSuit | undefined;

	for ( let i = 0; i < CALLBREAK_PLAYER_COUNT; i++ ) {
		const envelope = yield* envelopeOf( engine );
		const actor = envelope.context.currentPlayer;
		const view = yield* viewOf( engine, actor );
		const card = legalCards( view, trump, actor )[ 0 ]!;

		leadPlayer ??= actor;
		suit ??= card.slice( -1 ) as CardSuit;
		cards[ actor ] = card;

		yield* engine.playCard( { cardId: card, dealId: view.activeDeal!.id }, actor );
	}

	const trick = { leadPlayer: leadPlayer!, suit, cards } as Trick;
	return { trick, winner: determineTrickWinner( trick, trump, seats ) };
} );

/**
 * Declares and then plays a whole deal out.
 *
 * @param engine - The game to play.
 * @param trump - The table's trump suit.
 * @param [wins] - What every seat declares.
 * @returns Each seat's call and the tricks it actually took.
 */
const playDeal = (
	engine: Engine,
	trump: CardSuit,
	wins = 1
) => Effect.gen( function* () {
	yield* declareAll( engine, wins );

	const taken: Record<Player, number> = Object.fromEntries(
		seats.map( id => [ id, 0 ] )
	) as Record<Player, number>;

	for ( let i = 0; i < CALLBREAK_TRICKS_PER_DEAL; i++ ) {
		const { winner } = yield* playTrick( engine, trump );
		taken[ winner ] += 1;

		// The last trick rolls the table straight into the next deal, so there is
		// no longer a deal in play whose counters could be checked against.
		if ( i < CALLBREAK_TRICKS_PER_DEAL - 1 ) {
			const view = yield* viewOf( engine );
			expect( view.lastCompletedTrick?.winner ).toBe( winner );
			expect( view.activeDeal!.wins[ winner ] ).toBe( taken[ winner ] );
			expect( ( yield* envelopeOf( engine ) ).context.currentPlayer ).toBe( winner );
		}
	}

	return { calls: Object.fromEntries( seats.map( id => [ id, wins ] ) ), taken };
} );


describe( "dealing the table", () => {
	test( "deals thirteen cards to each of the four seats", () => {
		const { result } = table( engine => Effect.all( seats.map( id => viewOf( engine, id ) ) ) );

		const hands = result.map( view => view.hand );
		for ( const hand of hands ) {
			expect( hand ).toHaveLength( CALLBREAK_TRICKS_PER_DEAL );
		}

		expect( new Set( hands.flat() ).size ).toBe( 52 );
	} );

	test( "never puts a hand on the wire, only its size", () => {
		const { result } = table( engine => Effect.gen( function* () {
			return {
				own: yield* viewOf( engine, a ),
				opponent: yield* viewOf( engine, b ),
				spectator: yield* viewOf( engine )
			};
		} ) );

		const { own, opponent, spectator } = result;

		expect( Object.keys( own.activeDeal! ) ).not.toContain( "hands" );
		expect( spectator.hand ).toEqual( [] );
		expect( spectator.playerId ).toBeUndefined();
		expect( own.playerId ).toBe( a );
		expect( opponent.playerId ).toBe( b );

		// A seat's own cards are its own: nothing about them reaches another view.
		for ( const card of own.hand ) {
			expect( opponent.hand ).not.toContain( card );
			expect( JSON.stringify( spectator ) ).not.toContain( `"${ card }"` );
		}

		// Everyone sees how much everyone else is holding, spectators included.
		for ( const view of [ own, opponent, spectator ] ) {
			expect( view.handCounts ).toEqual( {
				[ a ]: 13,
				[ b ]: 13,
				[ c ]: 13,
				[ d ]: 13
			} );
		}
	} );

	test( "opens in the declaring phase, led by the first seat", () => {
		const { result } = table( engine => envelopeOf( engine ) );

		expect( result.status ).toBe( "IN_PROGRESS" );
		expect( result.context.phase ).toBe( "DECLARING" );
		expect( result.context.currentPlayer ).toBe( a );
		expect( ( result.view as CallbreakView ).activeDeal!.startingPlayer ).toBe( a );
	} );

	test( "starts everybody on nothing", () => {
		const { result } = table( engine => viewOf( engine ) );

		expect( result.scores ).toEqual( { [ a ]: 0, [ b ]: 0, [ c ]: 0, [ d ]: 0 } );
		expect( result.lastCompletedTrick ).toBeUndefined();
		expect( result.activeDeal!.tricks ).toEqual( [] );
	} );
} );


describe( "declaring", () => {
	test( "refuses a seat that is not the one being asked", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const view = yield* viewOf( engine, b );
			return yield* engine.declareWins( { wins: 3, dealId: view.activeDeal!.id }, b )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "refuses a call aimed at a deal that is not in play", () => {
		const { result } = table( engine =>
			engine.declareWins( { wins: 3, dealId: "not-this-deal" }, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as InvalidMove ).reason ).toBe( "Active Deal Not Found!" );
	} );

	test( "refuses a call outside the range a deal can pay", () => {
		const refusals = table( engine => Effect.gen( function* () {
			const dealId = ( yield* viewOf( engine, a ) ).activeDeal!.id;

			return yield* Effect.all( [ 0, 14, 2.5 ].map( wins =>
				engine.declareWins( { wins, dealId }, a ).pipe( Effect.flip ) ) );
		} ) ).result;

		for ( const refusal of refusals ) {
			expect( refusal._tag ).toBe( "swish/InvalidMove" );
		}
	} );

	test( "goes round the table and hands over to the play once everyone has called", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const order: Array<Player> = [];

			for ( let i = 0; i < CALLBREAK_PLAYER_COUNT; i++ ) {
				const actor = ( yield* envelopeOf( engine ) ).context.currentPlayer;
				order.push( actor );

				const dealId = ( yield* viewOf( engine, actor ) ).activeDeal!.id;
				yield* engine.declareWins( { wins: i + 1, dealId }, actor );
			}

			return { order, envelope: yield* envelopeOf( engine ) };
		} ) );

		expect( result.order ).toEqual( [ a, b, c, d ] );
		expect( result.envelope.context.phase ).toBe( "PLAYING" );
		expect( result.envelope.context.currentPlayer ).toBe( a );
		expect( ( result.envelope.view as CallbreakView ).activeDeal!.declarations ).toEqual( {
			[ a ]: 1,
			[ b ]: 2,
			[ c ]: 3,
			[ d ]: 4
		} );
	} );

	test( "refuses a card before the calls are in", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const view = yield* viewOf( engine, a );
			return yield* engine
				.playCard( { cardId: view.hand[ 0 ]!, dealId: view.activeDeal!.id }, a )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/MoveNotAllowed" );
	} );
} );


describe( "playing a trick", () => {
	test( "refuses a card the seat is not holding", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* declareAll( engine );

			const view = yield* viewOf( engine, a );
			const missing = ( yield* viewOf( engine, b ) ).hand[ 0 ]!;

			return yield* engine
				.playCard( { cardId: missing, dealId: view.activeDeal!.id }, a )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as InvalidMove ).reason ).toBe( "Card not in hand!" );
	} );

	test( "refuses every card the rules do not allow, and only those", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* declareAll( engine );

			// The opener may play anything, so the following seats are where the
			// follow-suit and heading rules actually bite.
			yield* playFirstLegalCard( engine, "S" );

			const actor = ( yield* envelopeOf( engine ) ).context.currentPlayer;
			const view = yield* viewOf( engine, actor );
			const legal = legalCards( view, "S", actor );
			const illegal = view.hand.filter( card => !legal.includes( card ) );

			const refusals = yield* Effect.all( illegal.map( card =>
				engine.playCard( { cardId: card, dealId: view.activeDeal!.id }, actor )
					.pipe( Effect.flip ) ) );

			return { legal, refusals };
		} ) );

		// The opening card fixes a suit, so a thirteen-card hand always has some
		// card the rules keep back — this is never a vacuous assertion.
		expect( result.legal.length ).toBeLessThan( CALLBREAK_TRICKS_PER_DEAL - 1 );
		expect( result.refusals.length ).toBeGreaterThan( 0 );

		for ( const refusal of result.refusals ) {
			expect( refusal._tag ).toBe( "swish/InvalidMove" );
			expect( ( refusal as InvalidMove ).reason ).toBe( "Card cannot be played!" );
		}
	} );

	test( "takes the card out of the hand it was played from", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* declareAll( engine );

			const before = yield* viewOf( engine, a );
			const card = legalCards( before, "S", a )[ 0 ]!;
			yield* engine.playCard( { cardId: card, dealId: before.activeDeal!.id }, a );

			return { card, after: yield* viewOf( engine, a ), table: yield* viewOf( engine ) };
		} ) );

		expect( result.after.hand ).not.toContain( result.card );
		expect( result.after.hand ).toHaveLength( CALLBREAK_TRICKS_PER_DEAL - 1 );
		expect( result.table.handCounts[ a ] ).toBe( CALLBREAK_TRICKS_PER_DEAL - 1 );
		expect( result.table.activeDeal!.tricks[ 0 ]!.cards[ a ] ).toBe( result.card );
		expect( result.table.activeDeal!.tricks[ 0 ]!.suit )
			.toBe( result.card.slice( -1 ) as CardSuit );
	} );

	test( "hands the lead to whoever took it", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* declareAll( engine );

			const { winner } = yield* playTrick( engine, "S" );
			const envelope = yield* envelopeOf( engine );
			const view = envelope.view as CallbreakView;

			return { winner, envelope, view };
		} ) );

		expect( result.envelope.context.currentPlayer ).toBe( result.winner );
		expect( result.view.lastCompletedTrick?.winner ).toBe( result.winner );
		expect( result.view.activeDeal!.wins[ result.winner ] ).toBe( 1 );
		expect( result.view.activeDeal!.tricks ).toHaveLength( 1 );

		// The next trick is not opened until its leader actually plays into it.
		for ( const id of seats ) {
			expect( result.view.handCounts[ id ] ).toBe( CALLBREAK_TRICKS_PER_DEAL - 1 );
		}
	} );

	test( "settles the trick the way the rules say", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* declareAll( engine );
			return yield* playTrick( engine, "S" );
		} ) );

		const { trick, winner } = result;
		const trumps = Object.values( trick.cards ).filter( card => card.endsWith( "S" ) );

		expect( Object.keys( trick.cards ) ).toHaveLength( CALLBREAK_PLAYER_COUNT );

		if ( trumps.length > 0 ) {
			expect( trick.cards[ winner ]!.endsWith( "S" ) ).toBe( true );
		} else {
			expect( trick.cards[ winner ]!.endsWith( trick.suit! ) ).toBe( true );
		}
	} );
} );


describe( "finishing a deal", () => {
	test( "scores every seat, deals again and rotates the lead", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const first = ( yield* viewOf( engine ) ).activeDeal!;
			const { taken } = yield* playDeal( engine, "S", 2 );

			return { first, taken, envelope: yield* envelopeOf( engine ) };
		} ) );

		const view = result.envelope.view as CallbreakView;

		expect( Object.values( result.taken ).reduce( ( sum, n ) => sum + n, 0 ) )
			.toBe( CALLBREAK_TRICKS_PER_DEAL );

		for ( const id of seats ) {
			expect( view.scores[ id ] ).toBe( calculateRoundScore( 2, result.taken[ id ] ) );
		}

		// A fresh deal, led by the next seat along, with everyone back to thirteen.
		expect( view.activeDeal!.id ).not.toBe( result.first.id );
		expect( view.activeDeal!.startingPlayer ).toBe( b );
		expect( view.activeDeal!.tricks ).toEqual( [] );
		expect( view.activeDeal!.declarations ).toEqual( {
			[ a ]: 0,
			[ b ]: 0,
			[ c ]: 0,
			[ d ]: 0
		} );

		expect( result.envelope.context.phase ).toBe( "DECLARING" );
		expect( result.envelope.context.currentPlayer ).toBe( b );
		expect( view.handCounts ).toEqual( {
			[ a ]: 13,
			[ b ]: 13,
			[ c ]: 13,
			[ d ]: 13
		} );
		expect( result.envelope.status ).toBe( "IN_PROGRESS" );
	} );

	test( "keeps a running total across deals", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const first = yield* playDeal( engine, "S", 2 );
			const afterFirst = ( yield* viewOf( engine ) ).scores;
			const second = yield* playDeal( engine, "S", 3 );

			return { first, second, afterFirst, afterSecond: ( yield* viewOf( engine ) ).scores };
		} ) );

		for ( const id of seats ) {
			expect( result.afterFirst[ id ] ).toBe( calculateRoundScore( 2, result.first.taken[ id ] ) );
			expect( result.afterSecond[ id ] ).toBe(
				result.afterFirst[ id ]! + calculateRoundScore( 3, result.second.taken[ id ] )
			);
		}
	} );
} );


describe( "finishing the game", () => {
	test( "stops after the configured number of deals and ranks the table", () => {
		const { result, saved } = table( engine => Effect.gen( function* () {
			for ( let deal = 0; deal < 5; deal++ ) {
				yield* playDeal( engine, "S", 2 );
			}

			return yield* envelopeOf( engine );
		} ), { dealCount: 5 } );

		const view = result.view as CallbreakView;
		const ranking = result.results!.ranking;

		expect( result.status ).toBe( "COMPLETED" );
		expect( ranking ).toHaveLength( CALLBREAK_PLAYER_COUNT );
		expect( ranking[ 0 ]!.rank ).toBe( 1 );

		// The standings and the crowned winner read the same totals.
		for ( const standing of ranking ) {
			expect( standing.score ).toBe( view.scores[ standing.playerId ] );
		}

		for ( let i = 1; i < ranking.length; i++ ) {
			expect( ranking[ i - 1 ]!.score! ).toBeGreaterThanOrEqual( ranking[ i ]!.score! );
		}

		// A shared top is a shared victory: callbreak has no tie-break, so the
		// standings name nobody rather than picking whoever sat down first.
		const shared = ranking[ 0 ]!.score === ranking[ 1 ]!.score;
		expect( result.results!.winner ).toBe( shared ? undefined : ranking[ 0 ]!.playerId );

		expect( saved.get( "callbreak:game-1" ) ).toBeDefined();
	} );
} );


describe( "the bot policy", () => {
	test( "plays a whole table of bots out to a legal finish", () => {
		const clock = testClock();

		const { result } = table( engine => Effect.gen( function* () {
			// Nothing fires on its own here: every wake-up is one bot move, so the
			// loop is the table playing itself one commit at a time.
			for ( let step = 0; step < 400; step++ ) {
				const envelope = yield* envelopeOf( engine );
				if ( envelope.status === "COMPLETED" ) {
					break;
				}

				clock.advance( BOT_DELAY_MS + 1 );
				yield* engine.alarm();
			}

			return yield* envelopeOf( engine );
		} ), { dealCount: 5, bots: true, clock } );

		const view = result.view as CallbreakView;

		expect( result.status ).toBe( "COMPLETED" );
		expect( result.results!.ranking ).toHaveLength( CALLBREAK_PLAYER_COUNT );

		// Five deals of thirteen tricks, so every seat's calls and takes are in.
		const total = seats.reduce( ( sum, id ) => sum + ( view.scores[ id ] ?? 0 ), 0 );
		expect( Number.isInteger( total ) ).toBe( true );
	} );

	test( "takes a human seat over without committing anything", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const before = yield* envelopeOf( engine );
			yield* engine.setAutoPlay( a, true );

			return { before, after: yield* envelopeOf( engine ) };
		} ) );

		// Callbreak declares a policy, so the switch is accepted — and it is
		// scheduling rather than state, so the log does not move under it.
		expect( result.before.autoPlay[ a ] ).toBeUndefined();
		expect( result.after.autoPlay[ a ] ).toBe( true );
		expect( result.after.version ).toBe( result.before.version );
	} );
} );


describe( "taking a move back", () => {
	test( "puts the card back in the hand it came from", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* declareAll( engine );

			const before = yield* viewOf( engine, a );
			const card = legalCards( before, "S", a )[ 0 ]!;
			yield* engine.playCard( { cardId: card, dealId: before.activeDeal!.id }, a );

			yield* engine.undo( a );
			const undone = yield* viewOf( engine, a );

			yield* engine.redo( a );
			return { card, before, undone, redone: yield* viewOf( engine, a ) };
		} ) );

		expect( result.undone.hand ).toEqual( result.before.hand );
		expect( result.undone.activeDeal!.tricks[ 0 ]!.cards ).toEqual( {} );
		expect( result.redone.hand ).not.toContain( result.card );
	} );

	test( "refuses to take back somebody else's move", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* declareAll( engine );

			const view = yield* viewOf( engine, a );
			const card = legalCards( view, "S", a )[ 0 ]!;
			yield* engine.playCard( { cardId: card, dealId: view.activeDeal!.id }, a );

			return yield* engine.undo( b ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/UndoNotAllowed" );
	} );
} );


/**
 * Plays the first legal card for whichever seat is being asked.
 *
 * @param engine - The game to play.
 * @param trump - The table's trump suit.
 */
function playFirstLegalCard( engine: Engine, trump: CardSuit ) {
	return Effect.gen( function* () {
		const actor = ( yield* envelopeOf( engine ) ).context.currentPlayer;
		const view = yield* viewOf( engine, actor );
		const card = legalCards( view, trump, actor )[ 0 ]!;

		yield* engine.playCard( { cardId: card, dealId: view.activeDeal!.id }, actor );
	} );
}
