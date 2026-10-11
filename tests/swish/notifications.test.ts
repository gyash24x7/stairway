import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";

import { assert, describe, it } from "@effect/vitest";

import { makeTable } from "@tests/harness/table";
import { seats } from "@tests/harness/users";
import { AskingEngine, AskingEngineLive, AskingStructure } from "@tests/swish/games/asking";
import { FlatEngine, FlatEngineLive, FlatStructure } from "@tests/swish/games/flat";

import type { Push } from "@/swish/server/notifier";


const Flat = { Engine: FlatEngine, EngineLive: FlatEngineLive, Structure: FlatStructure };
const Asking = { Engine: AskingEngine, EngineLive: AskingEngineLive, Structure: AskingStructure };

const alice = seats.alice.id;
const bob = seats.bob.id;
const carol = seats.carol.id;

const DUEL = [ seats.alice, seats.bob ];
const TRIO = [ seats.alice, seats.bob, seats.carol ];

const PARKED = { botDelayMillis: 3_600_000, moveTimeoutMillis: 3_600_000 };

/**
 * The engine forks `notify` detached, so a push lands a moment after the
 * command that caused it has returned. Everything below reads the log through
 * this, so it never reads it mid-flight.
 */
const settle = Effect.sleep( "10 millis" );

/** How many pushes have been sent so far — where to read the next ones from. */
const mark = ( pushes: () => ReadonlyArray<Push> ) => Effect.map( settle, () => pushes().length );

/** The pushes sent since `from`, as who was told what. */
const sentSince = ( pushes: () => ReadonlyArray<Push>, from = 0 ) => Effect.gen( function* () {
	yield* settle;
	return pushes().slice( from ).map( push => ( { to: push.playerId as string, kind: push.kind } ) );
} );

const flat = ( name: string, config = {} ) => makeTable( Flat, {
	players: DUEL,
	name,
	config: { playerCount: 2, allowBonus: true, target: 10, ...PARKED, ...config }
} );


describe( "swish engine: notifications", () => {

	it.live( "tells nobody when the creator sits at their own empty table", () => Effect.gen( function* () {
		const game = yield* flat( "push-create" );

		assert.deepStrictEqual( yield* sentSince( game.pushes ), [] );
	} ) );

	it.live(
		"tells the seated a player joined, then everybody the game started — the first seat that it is their turn",
		() => Effect.gen( function* () {
			const game = yield* flat( "push-join-start" );
			yield* game.joinAll();

			assert.deepStrictEqual( yield* sentSince( game.pushes ), [
				{ to: alice, kind: "joined" },
				{ to: alice, kind: "turn" },
				{ to: bob, kind: "started" }
			] );
		} )
	);

	it.live( "tells the next seat it is their turn after a move", () => Effect.gen( function* () {
		const game = yield* flat( "push-turn" );
		yield* game.joinAll();
		const from = yield* mark( game.pushes );

		yield* game.move( "alice", "score", { points: 1 } );

		assert.deepStrictEqual( yield* sentSince( game.pushes, from ), [ { to: bob, kind: "turn" } ] );
	} ) );

	it.live( "links each notice to its game and tags it by game", () => Effect.gen( function* () {
		const game = yield* flat( "push-link" );
		yield* game.joinAll();
		yield* game.move( "alice", "score", { points: 1 } );

		yield* settle;
		const last = game.pushes().at( -1 )!;
		assert.strictEqual( last.notice.url, `/flattest/${ game.id }` );
		assert.strictEqual( last.notice.tag, `flattest:${ game.id }` );
		assert.strictEqual( last.notice.body, "It's your turn." );
	} ) );

	it.live( "tells everybody seated when the game is over", () => Effect.gen( function* () {
		const game = yield* flat( "push-over" );
		yield* game.joinAll();
		const from = yield* mark( game.pushes );

		yield* game.move( "alice", "score", { points: 10 } );

		assert.deepStrictEqual( yield* sentSince( game.pushes, from ), [
			{ to: alice, kind: "completed" },
			{ to: bob, kind: "completed" }
		] );
	} ) );

	it.live( "sends nothing for a bot's seat, nor for a bot taking one", () => Effect.gen( function* () {
		const game = yield* makeTable( Flat, {
			players: [ seats.alice ],
			name: "push-bots",
			config: { playerCount: 2, allowBonus: true, target: 10, ...PARKED }
		} );

		yield* game.addBots();
		yield* game.move( "alice", "score", { points: 1 } );

		const sent = yield* sentSince( game.pushes );
		assert.isTrue( sent.every( push => push.to === alice ) );
		assert.isFalse( sent.some( push => push.kind === "joined" ) );
	} ) );

	it.live( "asks the responders of a window, and only them", () => Effect.gen( function* () {
		const game = yield* makeTable( Asking, {
			players: TRIO,
			name: "push-window",
			config: { playerCount: 3, chainDepth: 3, ...PARKED }
		} );
		yield* game.joinAll();
		const from = yield* mark( game.pushes );

		yield* game.move( "alice", "ask", {} );

		assert.deepStrictEqual( yield* sentSince( game.pushes, from ), [
			{ to: bob, kind: "respond" },
			{ to: carol, kind: "respond" }
		] );
	} ) );

	it.live( "points everybody at the rematch once somebody asks for one", () => Effect.gen( function* () {
		const game = yield* flat( "push-rematch" );
		yield* game.joinAll();
		yield* game.move( "alice", "score", { points: 10 } );
		const from = yield* mark( game.pushes );

		const next = yield* game.rematch( "bob" );
		yield* settle;

		const rematch = game.pushes().slice( from ).filter( push => push.kind === "rematch" );
		assert.deepStrictEqual( rematch.map( push => push.playerId as string ), [ alice, bob ] );
		assert.isTrue( rematch.every( push => push.notice.url === `/flattest/${ next.gameId }` ) );
	} ) );

	it.live( "leaves out a player who is watching the game", () => Effect.gen( function* () {
		const game = yield* flat( "push-watching" );
		yield* game.joinAll();

		const open = yield* Deferred.make<void>();
		const watching = yield* Effect.forkChild( game.run(
			game.engine.subscribe( game.ref )( seats.bob ).pipe(
				Stream.tap( () => Deferred.succeed( open, undefined ) ),
				Stream.runDrain,
				Effect.ignore
			)
		) );
		yield* Deferred.await( open );

		const from = yield* mark( game.pushes );
		yield* game.move( "alice", "score", { points: 1 } );
		assert.deepStrictEqual( yield* sentSince( game.pushes, from ), [] );

		yield* Fiber.interrupt( watching );

		const resumed = yield* mark( game.pushes );
		yield* game.move( "bob", "score", { points: 1 } );
		yield* game.move( "alice", "score", { points: 1 } );
		assert.deepStrictEqual( yield* sentSince( game.pushes, resumed ), [
			{ to: alice, kind: "turn" },
			{ to: bob, kind: "turn" }
		] );
	} ) );
} );
