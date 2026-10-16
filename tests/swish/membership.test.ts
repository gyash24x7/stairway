import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import { makeTable, PARKED, rejectionTag } from "@tests/harness/table";
import { seats } from "@tests/harness/users";
import { FlatEngine, FlatEngineLive, FlatStructure } from "@tests/swish/games/flat";


const Flat = { Engine: FlatEngine, EngineLive: FlatEngineLive, Structure: FlatStructure };

const DUEL = [ seats.alice, seats.bob ];

const table = ( name: string, config = {} ) => makeTable( Flat, {
	players: DUEL,
	name,
	config: { playerCount: 2, allowBonus: true, target: 10, ...PARKED, ...config }
} );

const watcher = { id: "watcher", name: "Watcher", avatar: "avatar://watcher" };
const stranger = { id: "stranger", name: "Stranger", avatar: "avatar://stranger" };


describe( "swish engine: membership", () => {

	it.live( "names a seated human a player, in the lobby", () => Effect.gen( function* () {
		const game = yield* table( "membership-lobby" );

		const got = yield* game.membership( seats.alice );
		assert.strictEqual( got.role, "player" );
		assert.strictEqual( got.status, "CREATED" );
	} ) );

	it.live( "follows the game's status once it starts", () => Effect.gen( function* () {
		const game = yield* table( "membership-started" );
		yield* game.joinAll();

		const got = yield* game.membership( seats.bob );
		assert.strictEqual( got.role, "player" );
		assert.strictEqual( got.status, "IN_PROGRESS" );
	} ) );

	it.live( "names somebody watching a spectator", () => Effect.gen( function* () {
		const game = yield* table( "membership-spectator" );
		yield* game.joinAll();
		yield* game.spectate( watcher );

		assert.strictEqual( ( yield* game.membership( watcher ) ).role, "spectator" );
	} ) );

	it.live( "names everybody else no one", () => Effect.gen( function* () {
		const game = yield* table( "membership-stranger" );

		assert.strictEqual( ( yield* game.membership( stranger ) ).role, "none" );
	} ) );

	it.live( "never names a machine-played seat a player", () => Effect.gen( function* () {
		const game = yield* table( "membership-bot" );
		yield* game.addBots();

		const view = yield* game.view();
		const bot = Object.values( view.players ).find( player => player.isBot === true );
		assert.isDefined( bot );

		const got = yield* game.membership( { id: bot!.id, name: bot!.name, avatar: bot!.avatar } );
		assert.strictEqual( got.role, "none" );
	} ) );

	it.live( "refuses a table that does not exist", () => Effect.gen( function* () {
		const game = yield* table( "membership-missing" );

		const tag = yield* rejectionTag(
			game.run( game.engine.membership( { gameId: "missing" as typeof game.id } )( stranger ) )
		);
		assert.strictEqual( tag, "swish/GameNotFound" );
	} ) );
} );
