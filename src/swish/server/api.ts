import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { SessionServiceLive } from "@/auth/server/session.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { SwishLedgerLive } from "@/platform/database/ledger.ts";
import { channels, games, players } from "@/platform/database/schema.ts";
import { Database } from "@/platform/database/service.ts";
import { SwishStorageLive, SwishSyncLive, SwishTimersLive } from "@/platform/do/swish.ts";
import { WebSocketDurableObject } from "@/platform/do/ws.ts";
import { ArchiveKV, SwishArchiveLive } from "@/platform/kv/archive.ts";
import { SessionStoreLive } from "@/platform/kv/session.ts";
import { toPlayerInfo } from "@/swish/server/utils.ts";
import { planRematch } from "@/swish/shared/rematch.ts";
import {
	GameCode,
	GameId,
	GameNotFound,
	GameRef,
	PlayerId,
	RematchUnavailable
} from "@/swish/shared/schema.ts";

import type { ChatPolicy } from "@/chat/shared/schema.ts";
import type { WebSocketDurableObjectServices } from "@/platform/do/ws.ts";
import type {
	SwishArchive,
	SwishLedger,
	SwishStorage,
	SwishSync,
	SwishTimers
} from "@/swish/server/services.ts";
import type { JoinGameInput } from "@/swish/shared/schema.ts";
import type {
	AutoPlayError,
	BaseGameConfig,
	GameIdParams,
	GameView,
	GetStateError,
	InitializeError,
	InitializeInput,
	JoinError,
	JoinTeamInput,
	LeaveTeamError,
	NameTeamError,
	NameTeamInput,
	PlayerInfo,
	RedoError,
	RematchError,
	RematchInput,
	SetAutoPlayInput,
	StartError,
	TeamError,
	UndoError
} from "@/swish/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

/** The host services an engine asks for, all of which this object supplies. */
type SwishHostServices = SwishStorage | SwishSync | SwishArchive | SwishLedger | SwishTimers;

/**
 * The Durable Object body every game shares: the engine, with the five host
 * services bound to this object's own storage, its sockets, the archive
 * namespace and the shared database, wrapped in the auth-gated WebSocket base.
 *
 * Only the class declaration stays per-game — `Cloudflare.DurableObject` needs a
 * distinct class name and its own self type, and that name is what the binding
 * is keyed on.
 *
 * @param engine - The game's engine, built by `makeEngine`.
 * @returns The object body, for `Cloudflare.DurableObject`.
 */
export const SwishDurableObject = <Shape extends object>(
	engine: Effect.Effect<Shape, never, SwishHostServices | WebSocketDurableObjectServices>
) => Effect.gen( function* () {
	const archive = yield* Cloudflare.KV.ReadWriteNamespace( ArchiveKV );
	const db = yield* Database;

	return yield* WebSocketDurableObject(
		engine.pipe(
			Effect.provide( [
				SwishStorageLive,
				SwishSyncLive,
				SwishArchiveLive( archive ),
				SwishLedgerLive( db ),
				SwishTimersLive
			] )
		)
	);
} ).pipe(
	Effect.provide( SessionServiceLive ),
	Effect.provide( SessionStoreLive ),
	Effect.provide( Cloudflare.D1.QueryDatabaseBinding ),
	Effect.provide( Cloudflare.KV.ReadWriteNamespaceBinding )
);


// --- Engine client -----------------------------------------------------------

/**
 * The engine commands whose shape is the same in every game, so the handlers
 * below can call them without being told which they are.
 *
 * `initialize`, `getState` and the moves are deliberately absent: their input or
 * their success is the game's own, and a structural type here would flatten it.
 * Those three are reached through a picker instead — a `client => client.<name>`
 * the game passes in, typed at its own call site — which is what keeps the
 * handler's payload and success exactly what the contract declares.
 */
type SwishCommands = {
	readonly join: ( player: PlayerInfo ) => Effect.Effect<GameRef, JoinError>;
	readonly addBots: ( playerId: PlayerId ) => Effect.Effect<void, JoinError>;
	readonly start: ( playerId: PlayerId ) => Effect.Effect<void, StartError>;
	readonly joinTeam: (
		playerId: PlayerId,
		team: JoinTeamInput[ "team" ]
	) => Effect.Effect<void, TeamError>;
	readonly nameTeam: (
		playerId: PlayerId,
		team: NameTeamInput[ "team" ],
		name: NameTeamInput[ "name" ]
	) => Effect.Effect<void, NameTeamError>;
	readonly setAutoPlay: (
		playerId: PlayerId,
		enabled: boolean
	) => Effect.Effect<void, AutoPlayError>;
	readonly leaveTeam: ( playerId: PlayerId ) => Effect.Effect<void, LeaveTeamError>;
	readonly setRematch: (
		playerId: PlayerId,
		ref: GameRef
	) => Effect.Effect<GameRef, RematchError>;
	readonly undo: ( playerId: PlayerId ) => Effect.Effect<void, UndoError>;
	readonly redo: ( playerId: PlayerId ) => Effect.Effect<void, RedoError>;
};

/** The Durable Object namespace a game's engine lives in. */
type GameNamespace<Client extends SwishCommands> = {
	readonly getByName: ( name: string ) => Client;
};

type GameApiOptions<Client extends SwishCommands> = {
	/** The game's name — its row in `games`, its chat label, and the group id. */
	readonly game: string;
	/** The Durable Object namespace holding this game's engines. */
	readonly ns: GameNamespace<Client>;
	/** What the game's chat channel allows. Defaults to text and reactions. */
	readonly chat?: ChatPolicy;
};

const DEFAULT_CHAT_POLICY: ChatPolicy = { text: true, reactions: true };


// --- HTTP handlers -----------------------------------------------------------

/**
 * The handlers every game's `server/api.ts` is built from.
 *
 * Each one resolves the caller from `AuthContext` and the game from the path,
 * then hands both to one engine command — the part that differs between games is
 * which command, and that is either read off `SwishCommands` or supplied as a
 * picker. Handlers are written against the narrowest request they read
 * (`{ params }`, `{ payload }`, or both), which is what lets them be dropped
 * straight into `handlers.handle( ... )` for endpoints carrying more.
 *
 * @param options - The game's name, its Durable Object namespace and its chat policy.
 * @returns The handler set, once `Database` is available.
 */
export const makeGameApi = <Client extends SwishCommands>(
	{ game, ns, chat = DEFAULT_CHAT_POLICY }: GameApiOptions<Client>
) => Effect.gen( function* () {
	const db = yield* Database;

	/** The game's row, or `GameNotFound` — a game of another kind is not this one. */
	const findGame = Effect.fn( function* ( gameId: GameId ) {
		const row = yield* db.query.games
			.findFirst( { where: { id: gameId, game } } )
			.pipe( Effect.orDie );

		if ( !row ) {
			return yield* new GameNotFound( { id: gameId } );
		}

		return row;
	} );

	/** Runs `f` against the named game's engine, as the authenticated caller. */
	const withGame = <A, E, R>( f: (
		client: Client,
		playerId: PlayerId
	) => Effect.Effect<A, E, R> ) =>
		Effect.fn( function* ( { params }: { readonly params: GameIdParams } ) {
			const { user } = yield* AuthContext;
			const row = yield* findGame( params.gameId );
			return yield* f( ns.getByName( row.id ), PlayerId.make( user.id ) );
		} );

	/** The same, for a command carrying the caller's own payload. */
	const withPayload = <P, A, E, R>(
		f: ( client: Client, playerId: PlayerId, payload: P ) => Effect.Effect<A, E, R>
	) => Effect.fn( function* (
		{ params, payload }: { readonly params: GameIdParams; readonly payload: P }
	) {
		const { user } = yield* AuthContext;
		const row = yield* findGame( params.gameId );
		return yield* f( ns.getByName( row.id ), PlayerId.make( user.id ), payload );
	} );

	return {
		/**
		 * Creates the game: its row, its creator's row, its chat channel, and then
		 * the engine itself. The config is the only part a game owns, so it is all
		 * the caller supplies — and it is built before anything is inserted, so a
		 * config the engine would refuse leaves no rows behind.
		 *
		 * The creator is seated immediately after `initialize`, which is what keeps
		 * `context.currentPlayer` and the roster in agreement.
		 *
		 * @param pick - Names the engine's `initialize`.
		 * @param buildConfig - Builds this game's config from the create payload.
		 * @returns The `createGame` handler.
		 */
		createGame: <P, C extends BaseGameConfig, A, R, E2, R2>(
			pick: ( client: Client ) => ( input: InitializeInput<C> ) => Effect.Effect<A, InitializeError, R>,
			buildConfig: ( payload: P ) => Effect.Effect<C, E2, R2>
		) => Effect.fn( function* ( { payload }: { readonly payload: P } ) {
			const { user } = yield* AuthContext;
			const config = yield* buildConfig( payload );

			const [ row ] = yield* db.insert( games )
				.values( { game } )
				.returning()
				.pipe( Effect.orDie );

			yield* db.insert( players ).values( { ...user, gameId: row.id } ).pipe( Effect.orDie );

			yield* db.insert( channels ).values( {
				id: row.id,
				refType: "game",
				refId: row.id,
				label: game,
				policy: chat
			} ).pipe( Effect.orDie );

			const client = ns.getByName( row.id );
			const ref = yield* pick( client )( {
				id: GameId.make( row.id ),
				code: GameCode.make( row.code ),
				creator: user.id,
				config
			} );

			yield* client.join( toPlayerInfo( user ) );

			return ref;
		} ),

		/**
		 * Seats a player a creator left room for. The engine takes the seat first:
		 * it is the thing that can refuse (`GameFull`, `GameNotJoinable`), and
		 * inserting the row ahead of it would record a player against a game they
		 * never got into. The insert is idempotent to match — the engine treats a
		 * re-join as a silent no-op, while `players` is keyed on the player and the
		 * game together and would throw on the second attempt.
		 */
		join: Effect.fn( function* ( { payload }: { readonly payload: JoinGameInput } ) {
			const { user } = yield* AuthContext;

			const row = yield* db.query.games
				.findFirst( { where: { code: payload.code, game } } )
				.pipe( Effect.orDie );

			if ( !row ) {
				return yield* new GameNotFound( { code: payload.code } );
			}

			const ref = yield* ns.getByName( row.id ).join( toPlayerInfo( user ) );

			yield* db.insert( players )
				.values( { ...user, gameId: row.id } )
				.onConflictDoNothing()
				.pipe( Effect.orDie );

			return ref;
		} ),

		/**
		 * The game as the caller may see it. A caller holding no seat still gets to
		 * watch: the engine builds the table view for an absent audience, which is
		 * every private region redacted.
		 *
		 * @param pick - Names the engine's `getState`.
		 * @returns The `getView` handler.
		 */
		getView: <A, R>(
			pick: ( client: Client ) => ( playerId?: PlayerId ) => Effect.Effect<A, GetStateError, R>
		) => withGame( ( client, playerId ) => pick( client )( playerId ).pipe(
			Effect.catchTag( "swish/NotAMember", () => pick( client )() )
		) ),

		/** Fills the remaining seats with machines, which is also what starts an auto-starting game. */
		addBots: withGame( ( client, playerId ) => client.addBots( playerId ) ),

		/** Starts a filled game sitting at `PLAYERS_READY`. */
		start: withGame( ( client, playerId ) => client.start( playerId ) ),

		/** Takes a side, or moves to another one. */
		joinTeam: withPayload( ( client, playerId, payload: JoinTeamInput ) =>
			client.joinTeam( playerId, payload.team ) ),

		/** Names the caller's own side, once. */
		nameTeam: withPayload( ( client, playerId, payload: NameTeamInput ) =>
			client.nameTeam( playerId, payload.team, payload.name ) ),

		/** Hands the caller's own seat to the game's `botMove` policy, or takes it back. */
		setAutoPlay: withPayload( ( client, playerId, payload: SetAutoPlayInput ) =>
			client.setAutoPlay( playerId, payload.enabled ) ),

		/** Steps the caller off their own side, freeing the seat for someone else. */
		leaveTeam: withGame( ( client, playerId ) => client.leaveTeam( playerId ) ),

		/**
		 * Plays the same people again: another game of this kind, with this game's
		 * config over this game's roster.
		 *
		 * The ordering below is the whole design, and it is ordered around one
		 * invariant — **the only write anyone else can observe is the last one, and
		 * by then the new table is complete.** A rematch is announced by pushing a
		 * pointer down every socket at the finished table, so announcing it before
		 * the new game had rows and an initialized object would hand every client a
		 * game that answers `GameNotFound`.
		 *
		 * Which means the announcement cannot also be the lock. The lock is the
		 * `games` row instead: `rematch_of` is unique, so the insert that has to
		 * happen anyway decides who owns the rematch, and a caller who loses reads
		 * the winner's row back and returns *that*. Losing is answered rather than
		 * refused on purpose — a table full of people all pressing the button at the
		 * end of a game is the ordinary case, everyone should land in the same game,
		 * and the client toasts every mutation error it sees.
		 *
		 * Nothing the new game's engine can raise is reported: its config and its
		 * roster come from a game this same engine already accepted and ran to
		 * completion, so a refusal there is a bug in the rematch rather than
		 * something the caller did, and it dies instead of being dressed up as a
		 * decision.
		 *
		 * @param pick - Names the engine's `initialize`, on the new game.
		 * @param read - Names the engine's `getState`, on the finished one.
		 * @returns The `rematch` handler.
		 */
		rematch: <V, C extends BaseGameConfig, A, R, R2>(
			pick: ( client: Client ) => (
				input: InitializeInput<C>
			) => Effect.Effect<A, InitializeError, R>,
			read: ( client: Client ) => (
				playerId?: PlayerId
			) => Effect.Effect<GameView<V, C>, GetStateError, R2>
		) => Effect.fn( function* (
			{ params, payload }: {
				readonly params: GameIdParams;
				readonly payload: RematchInput;
			}
		) {
			const { user } = yield* AuthContext;
			const playerId = PlayerId.make( user.id );
			const row = yield* findGame( params.gameId );
			const previous = ns.getByName( row.id );

			// Read as the caller, and deliberately without `getView`'s fallback to the
			// table view: here `NotAMember` is the gate. Anyone may watch a game; only
			// someone who sat at it may call the next one.
			const source = yield* read( previous )( playerId );

			if ( source.status !== "COMPLETED" ) {
				return yield* new RematchUnavailable( { status: source.status } );
			}

			const plan = planRematch( source, payload.keepTeams );

			const [ created ] = yield* db.insert( games )
				.values( { game, rematchOf: row.id } )
				.onConflictDoNothing( { target: games.rematchOf } )
				.returning()
				.pipe( Effect.orDie );

			// Somebody else got there first. The conflict is scoped to `rematch_of`
			// rather than left bare, so a code collision cannot be misread as one.
			if ( !created ) {
				const existing = yield* db.query.games
					.findFirst( { where: { rematchOf: row.id, game } } )
					.pipe( Effect.orDie );

				if ( !existing ) {
					return yield* new GameNotFound( { id: params.gameId } );
				}

				return GameRef.make( {
					id: GameId.make( existing.id ),
					code: GameCode.make( existing.code )
				} );
			}

			const ref = GameRef.make( {
				id: GameId.make( created.id ),
				code: GameCode.make( created.code )
			} );

			// Bots hold seats but never hold rows — a query about people joins
			// `players` and drops the machines.
			const humans = plan.players.filter( player => !player.isBot );
			if ( humans.length > 0 ) {
				yield* db.insert( players )
					.values( humans.map( player => ( {
						id: player.id,
						name: player.name,
						avatar: player.avatar,
						gameId: created.id
					} ) ) )
					.onConflictDoNothing()
					.pipe( Effect.orDie );
			}

			yield* db.insert( channels ).values( {
				id: created.id,
				refType: "game",
				refId: created.id,
				label: game,
				policy: chat
			} ).pipe( Effect.orDie );

			const next = ns.getByName( created.id );
			yield* pick( next )( {
				id: ref.id,
				code: ref.code,
				creator: user.id,
				config: source.config
			} ).pipe( Effect.orDie );

			// Each seat takes its side as it sits down rather than in a second pass.
			// Filling the last seat of an auto-starting game arms its countdown, and a
			// side claimed in the same breath as the seat cannot lose the race to it.
			const sides = new Map( plan.teams.map( seat => [ seat.playerId, seat.team ] ) );
			for ( const player of plan.players ) {
				yield* next.join( player ).pipe( Effect.orDie );

				const team = sides.get( player.id );
				if ( team ) {
					yield* next.joinTeam( player.id, team ).pipe( Effect.orDie );
				}
			}

			for ( const named of plan.teamNames ) {
				yield* next.nameTeam( named.by, named.team, named.name ).pipe( Effect.orDie );
			}

			return yield* previous.setRematch( playerId, ref ).pipe( Effect.orDie );
		} ),

		/** Steps the log cursor back over the caller's own newest move. */
		undo: withGame( ( client, playerId ) => client.undo( playerId ) ),

		/** Replays a move the caller undid. */
		redo: withGame( ( client, playerId ) => client.redo( playerId ) ),

		/**
		 * A move: the caller's own input, already decoded by the endpoint, handed
		 * to the engine command `pick` names.
		 *
		 * @param pick - Names the engine command this move maps to.
		 * @returns The move's handler.
		 */
		move: <I, A, E, R>(
			pick: ( client: Client ) => ( input: I, playerId: PlayerId ) => Effect.Effect<A, E, R>
		) => withPayload( ( client, playerId, payload: I ) => pick( client )( payload, playerId ) )
	};
} );
