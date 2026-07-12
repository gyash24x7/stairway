// apps/web/src/effect/swish-layers.ts — Cloudflare implementations of the swish
// engine's six host service tags (`@s2h/swish/services`).
//
// The engine is host-agnostic: it depends only on the abstract `GameStore`,
// `EventStore`, `Scheduler`, `GameArchive`, `GameRepo` and `Ids` tags. This file
// backs them with real Cloudflare primitives, using the RAW async APIs wrapped in
// `Effect.promise` (so it stays decoupled from alchemy's colored-effect services):
//
//   GameStore / EventStore / Scheduler -> the per-game Durable Object's storage + alarm
//   GameRepo                            -> D1 (the `@s2h/db` `games` table)
//   GameArchive                         -> KV (`env.GAMES_KV`)
//   Ids                                 -> `@s2h/utils/generator`
//
// `makeStorageServices(storage)` is built inside the DO from `state.raw.storage`;
// the D1/KV/Ids layers are static. NOT wired into the running Worker yet.

import { and, eq, inArray, lt } from "drizzle-orm";
import { Effect, Layer, Option } from "effect";
import { db } from "@s2h/db";
import { games } from "@s2h/db/schema";
import {
	type AlarmKind,
	EventStore,
	GameArchive,
	GameRepo,
	type GameRow,
	GameStore,
	Ids,
	Scheduler
} from "@s2h/swish/services";
import { GameCode, GameId } from "@s2h/swish/schema";
import { generateAvatar, generateGameCode, generateId, generateName } from "@s2h/utils/generator";
import { env } from "cloudflare:workers";

// Durable Object storage keys.
const KEY_GAME = "gameData";
const KEY_LOG_BASE = "log:base";
const KEY_LOG_COMMITS = "log:commits";
const KEY_LOG_CURSOR = "log:cursor";
const KEY_ALARM = "alarm:kind";

const toGameRow = ( row: typeof games.$inferSelect ): GameRow => ( {
	id: GameId.make( row.id ),
	code: GameCode.make( row.code ),
	game: row.game,
	completed: row.completed,
	createdAt: row.createdAt
} );

// --- Durable-Object-backed services (single-game storage) ------------------

const gameStoreLayer = ( storage: DurableObjectStorage ) =>
	Layer.succeed( GameStore, {
		load: Effect.promise( async () => Option.fromNullishOr( await storage.get<unknown>( KEY_GAME ) ) ),
		save: ( encoded ) => Effect.promise( async () => {
			await storage.put( KEY_GAME, encoded );
		} ),
		clear: Effect.promise( async () => {
			await storage.deleteAll();
		} )
	} );

const eventStoreLayer = ( storage: DurableObjectStorage ) => {
	const readCommits = () =>
		storage.get<ReadonlyArray<unknown>>( KEY_LOG_COMMITS ).then( ( c ) => c ?? [] );
	const readCursor = () => storage.get<number>( KEY_LOG_CURSOR ).then( ( c ) => c ?? -1 );

	return Layer.succeed( EventStore, {
		setBase: ( encoded ) => Effect.promise( async () => {
			await storage.put( KEY_LOG_BASE, encoded );
			await storage.put( KEY_LOG_COMMITS, [] );
			await storage.put( KEY_LOG_CURSOR, -1 );
		} ),
		append: ( commit ) => Effect.promise( async () => {
			const commits = await readCommits();
			const cursor = await readCursor();
			const kept = [ ...commits.slice( 0, cursor + 1 ), commit ];
			await storage.put( KEY_LOG_COMMITS, kept );
			await storage.put( KEY_LOG_CURSOR, kept.length - 1 );
		} ),
		moveCursor: ( delta ) => Effect.promise( async () => {
			const commits = await readCommits();
			const cursor = await readCursor();
			const next = cursor + delta;
			if ( next < -1 || next > commits.length - 1 ) {
				return Option.none();
			}
			await storage.put( KEY_LOG_CURSOR, next );
			const movedOver = delta === -1 ? commits[ cursor ] : commits[ next ];
			return Option.fromNullishOr( movedOver );
		} ),
		read: Effect.promise( async () => ( {
			base: await storage.get<unknown>( KEY_LOG_BASE ),
			commits: await readCommits(),
			cursor: await readCursor()
		} ) )
	} );
};

const schedulerLayer = ( storage: DurableObjectStorage ) =>
	Layer.succeed( Scheduler, {
		schedule: ( delayMillis, alarm ) => Effect.promise( async () => {
			await storage.put( KEY_ALARM, alarm );
			await storage.setAlarm( Date.now() + delayMillis );
		} ),
		cancel: Effect.promise( async () => {
			await storage.deleteAlarm();
			await storage.delete( KEY_ALARM );
		} ),
		read: Effect.promise( async () => Option.fromNullishOr( await storage.get<AlarmKind>( KEY_ALARM ) ) )
	} );

// --- Env-backed services (shared across games) -----------------------------

const gameArchiveLayer = Layer.succeed( GameArchive, {
	put: ( key, encoded ) => Effect.promise( async () => {
		await env.GAMES_KV.put( key, JSON.stringify( encoded ) );
	} ),
	get: ( key ) => Effect.promise( async () => Option.fromNullishOr( await env.GAMES_KV.get<unknown>( key, "json" ) ) )
} );

const gameRepoLayer = Layer.succeed( GameRepo, {
	create: ( game ) => Effect.promise( async () => {
		const [ row ] = await db.insert( games ).values( { game } ).returning();
		return toGameRow( row! );
	} ),
	byId: ( game, id ) => Effect.promise( async () => {
		const row = await db.query.games.findFirst( {
			where: and( eq( games.game, game ), eq( games.id, id ) )
		} );
		return row ? Option.some( toGameRow( row ) ) : Option.none();
	} ),
	byCode: ( game, code ) => Effect.promise( async () => {
		const row = await db.query.games.findFirst( {
			where: and( eq( games.game, game ), eq( games.code, code ) )
		} );
		return row ? Option.some( toGameRow( row ) ) : Option.none();
	} ),
	markCompleted: ( id ) => Effect.promise( async () => {
		await db.update( games ).set( { completed: 1 } ).where( eq( games.id, id ) );
	} ),
	listStale: ( olderThanSeconds ) => Effect.promise( async () => {
		const cutoff = Date.now() / 1000 - olderThanSeconds;
		const rows = await db.select().from( games )
			.where( and( eq( games.completed, 0 ), lt( games.createdAt, cutoff ) ) );
		return rows.map( toGameRow );
	} ),
	remove: ( ids ) => Effect.promise( async () => {
		if ( ids.length === 0 ) {
			return;
		}
		await db.delete( games ).where( inArray( games.id, ids as ReadonlyArray<string> as string[] ) );
	} )
} );

const idsLayer = Layer.succeed( Ids, {
	gameId: Effect.sync( () => GameId.make( generateId() ) ),
	code: Effect.sync( () => GameCode.make( generateGameCode() ) ),
	avatar: Effect.sync( () => generateAvatar() ),
	botIdentity: Effect.sync( () => ( {
		id: generateId(),
		name: generateName(),
		avatar: generateAvatar()
	} ) ),
	commitId: Effect.sync( () => generateId() )
} );

/**
 * All six swish services for one game instance, backed by the given Durable
 * Object storage plus the shared D1/KV/generator layers. Provide this alongside
 * a game's `<Game>Rpcs.layer` to satisfy the engine's `EngineServices`.
 */
export const makeSwishLayers = ( storage: DurableObjectStorage ): Layer.Layer<
	GameStore | EventStore | Scheduler | GameArchive | GameRepo | Ids
> =>
	Layer.mergeAll(
		gameStoreLayer( storage ),
		eventStoreLayer( storage ),
		schedulerLayer( storage ),
		gameArchiveLayer,
		gameRepoLayer,
		idsLayer
	);
