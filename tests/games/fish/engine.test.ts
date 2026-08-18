import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { fish } from "@/games/fish/server/engine.ts";
import { asksOf, buildConfig } from "@/games/fish/server/utils.ts";
import { claimsOf, getBookForCard, getCardsOfBook } from "@/games/fish/shared/utils.ts";
import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { GameCode, GameId, PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { opponentsOf, teamMatesOf } from "@/swish/shared/teams.ts";
import { TestHost } from "@tests/helpers/host.ts";

import type { BookType, PlayerCount, TeamCount } from "@/games/fish/shared/schema.ts";
import type { UserId } from "@/auth/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );

const seat = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar", isBot: true } );

/**
 * Drives fish against the in-memory host, with the clock parked well ahead so
 * every timer the engine arms is already due — one `alarm()` therefore plays
 * exactly one bot turn, and the whole game is a loop rather than a wait.
 */
const run = <A, E>(
	body: ( engine: Effect.Success<typeof fish> ) => Effect.Effect<A, E>
) => {
	const cells = new Map<string, unknown>();
	const saved = new Map<string, unknown>();
	const now = () => Date.now() + 24 * 60 * 60 * 1000;

	const program = Effect.gen( function* () {
		const engine = yield* fish;
		return yield* body( engine );
	} ).pipe( Effect.provide( TestHost( { cells, saved, now } ) ) );

	return { result: Effect.runSync( program ), cells, saved };
};

const create = (
	playerCount: PlayerCount,
	type: BookType,
	teamCount: TeamCount,
	creator: Player
) => ( {
	id: GameId.make( "game-1" ),
	code: GameCode.make( "CODE" ),
	creator: creator as UserId,
	config: buildConfig( playerCount, type, teamCount )
} );

const sumOf = <T>( rows: readonly T[], pick: ( row: T ) => number ) =>
	rows.reduce( ( total, row ) => total + pick( row ), 0 );

const seats = ( count: number ) =>
	Array.from( { length: count }, ( _, index ) => player( `p${ index }` ) );

/** Seats a full table of bots and starts it. */
const table = ( engine: Effect.Success<typeof fish>, count: PlayerCount, type: BookType ) =>
	Effect.gen( function* () {
		const players = seats( count );
		yield* engine.initialize( create( count, type, 2, players[ 0 ]! ) );

		for ( const id of players ) {
			yield* engine.join( seat( id ) );
		}

		// Fish is started by hand, so that a lobby has time to pick sides.
		yield* engine.start( players[ 0 ]! );

		return players;
	} );

/**
 * Plays the table out through the bot policy. Every move goes through the real
 * `submitMove`, which dies on an illegal one — so a policy that proposes a move
 * its own rules refuse fails this loop rather than silently passing.
 */
const playOut = ( engine: Effect.Success<typeof fish>, limit = 2000 ) =>
	Effect.gen( function* () {
		let previous = -1;

		for ( let turn = 0; turn < limit; turn++ ) {
			const view = yield* engine.getState();
			if ( view.status === "COMPLETED" ) {
				return { view, stalled: false };
			}

			if ( view.version === previous ) {
				return { view, stalled: true };
			}

			previous = view.version;
			yield* engine.alarm();
		}

		return { view: yield* engine.getState(), stalled: true };
	} );

describe( "a dealt table", () => {
	test( "deals the whole deck out evenly, whatever the variant", () => {
		for ( const [ count, type ] of [
			[ 4, "NORMAL" ],
			[ 6, "NORMAL" ],
			[ 8, "NORMAL" ],
			[ 4, "CANADIAN" ],
			[ 6, "CANADIAN" ],
			[ 8, "CANADIAN" ]
		] as ReadonlyArray<[ PlayerCount, BookType ]> ) {
			const { result } = run( engine => Effect.gen( function* () {
				const players = yield* table( engine, count, type );
				const view = yield* engine.getState( players[ 0 ] );
				return { view, config: buildConfig( count, type, 2 ) };
			} ) );

			const counts = Object.values( result.view.view.cardCounts );
			const dealt = counts.reduce( ( sum, held ) => sum + held, 0 );

			expect( result.view.status ).toBe( "IN_PROGRESS" );
			expect( counts.length ).toBe( count );
			expect( dealt ).toBe( result.config.deckType );
			expect( new Set( counts ).size ).toBe( 1 );
			expect( result.config.books.length * result.config.bookSize )
				.toBe( result.config.deckType );
		}
	} );

	test( "seats the sides so they alternate, and hands one seat its own view only", () => {
		const { result } = run( engine => Effect.gen( function* () {
			const players = yield* table( engine, 6, "CANADIAN" );
			const own = yield* engine.getState( players[ 0 ] );
			const table_ = yield* engine.getState();
			return { own, table: table_, context: own.context };
		} ) );

		const order = result.context.players;
		const sides = order.map( id => result.context.teams[ id ] );

		expect( new Set( sides ).size ).toBe( 2 );
		expect( sides[ 0 ] ).not.toBe( sides[ 1 ] );
		expect( sides[ 0 ] ).toBe( sides[ 2 ]! );

		expect( result.own.view.hand.length ).toBeGreaterThan( 0 );
		expect( result.own.view.playerId ).toBeDefined();
		expect( result.table.view.hand ).toEqual( [] );
		expect( result.table.view.playerId ).toBeUndefined();
	} );

	test( "carries no metrics while the game is still on", () => {
		const { result } = run( engine => Effect.gen( function* () {
			const players = yield* table( engine, 6, "CANADIAN" );
			return yield* engine.getState( players[ 0 ] );
		} ) );

		expect( result.view.metrics ).toBeUndefined();
	} );
} );

describe( "the rules", () => {
	const startedTable = ( engine: Effect.Success<typeof fish> ) =>
		Effect.gen( function* () {
			const players = yield* table( engine, 6, "CANADIAN" );
			const view = yield* engine.getState();
			return { players, current: view.context.currentPlayer, context: view.context };
		} );

	test( "refuses an ask aimed at a teammate", () => {
		const { result } = run( engine => Effect.gen( function* () {
			const { current, context } = yield* startedTable( engine );
			const mate = teamMatesOf( context, current )[ 0 ]!;
			const own = yield* engine.getState( current );

			return yield* engine
				.askCard( { from: mate, cardId: own.view.hand[ 0 ]! }, current )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a claim that names an opponent as a holder", () => {
		const { result } = run( engine => Effect.gen( function* () {
			const { current, context } = yield* startedTable( engine );
			const own = yield* engine.getState( current );
			const rival = opponentsOf( context, current )[ 0 ]!;

			const book = getBookForCard( own.view.hand[ 0 ]!, "CANADIAN" )!;
			const claim = Object.fromEntries(
				getCardsOfBook( book ).map( id => [ id, rival ] )
			);

			return yield* engine.claimBook( { claim }, current ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as { reason: string } ).reason ).toContain( "your own team" );
	} );
} );

describe( "a bot table", () => {
	const variants: ReadonlyArray<[ PlayerCount, BookType ]> = [
		[ 4, "NORMAL" ],
		[ 6, "CANADIAN" ],
		[ 8, "CANADIAN" ]
	];

	for ( const [ count, type ] of variants ) {
		test( `plays ${ count }-seat ${ type } out to a finish`, () => {
			const { result } = run( engine => Effect.gen( function* () {
				yield* table( engine, count, type );
				return yield* playOut( engine );
			} ) );

			expect( result.stalled ).toBe( false );
			expect( result.view.status ).toBe( "COMPLETED" );

			const claims = claimsOf( result.view.view );
			const claimed = claims.map( claim => claim.book );
			const config = buildConfig( count, type, 2 );

			expect( claimed.length ).toBe( config.books.length );
			expect( new Set( claimed ).size ).toBe( claimed.length );

			const results = result.view.results!;
			expect( results.ranking.length ).toBe( count );
			expect( results.teamRanking!.length ).toBe( 2 );
			expect( results.winner ).toBeUndefined();

			const booksWon = results.teamRanking!.reduce(
				( sum, standing ) => sum + ( standing.score ?? 0 ),
				0
			);
			expect( booksWon ).toBe( config.books.length );

			const drawn = results.teamRanking![ 0 ]!.score === results.teamRanking![ 1 ]!.score;
			expect( results.winningTeam === undefined ).toBe( drawn );

			// The summary arrives with the finish, and reconciles with the histories
			// it was folded from — one entry per seat, whatever they did with it.
			const metrics = result.view.view.metrics!;
			const rows = Object.values( metrics );
			const asks = asksOf( result.view.view );

			expect( rows.length ).toBe( count );
			expect( sumOf( rows, row => row.totalAsks ) ).toBe( asks.length );
			expect( sumOf( rows, row => row.cardsTaken ) )
				.toBe( asks.filter( ask => ask.success ).length );
			expect( sumOf( rows, row => row.cardsGiven ) )
				.toBe( sumOf( rows, row => row.cardsTaken ) );
			expect( sumOf( rows, row => row.totalClaims ) ).toBe( claimed.length );
			expect( sumOf( rows, row => row.successfulClaims ) )
				.toBe( claims.filter( claim => claim.success ).length );

			// An eight-seat canadian table is hundreds of turns of real belief
			// tracking, which runs past the default budget on a loaded machine.
		}, 30_000 );
	}
} );
