import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { SessionServiceLive } from "@/auth/server/session.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { SwishStorageLive, SwishSyncLive, SwishTimersLive } from "@/platform/do/swish.ts";
import { WebSocketDurableObject } from "@/platform/do/ws.ts";
import { SessionStoreLive } from "@/platform/kv/session.ts";
import { OutboxQueue, SwishOutboxLive } from "@/platform/queue/outbox.ts";
import { generateGameCode } from "@/shared/utils/generator.ts";
import { SwishArchive, SwishDatabase } from "@/swish/server/services.ts";
import { toPlayerInfo } from "@/swish/server/utils.ts";
import {
	GameAddress,
	GameCode,
	GameId,
	GameNotFound,
	GameRef,
	RematchUnavailable
} from "@/swish/shared/schema.ts";
import { planRematch } from "@/swish/shared/teams.ts";

import type { WebSocketDurableObjectServices } from "@/platform/do/ws.ts";
import type { SwishOutbox, SwishStorage, SwishSync, SwishTimers } from "@/swish/server/services.ts";
import type {
	ArchivedGame,
	AutoPlayInput,
	BaseGameConfig,
	BaseMoveClientShape,
	EngineClient,
	GameIdParams,
	GameView,
	JoinGameInput,
	JoinTeamInput,
	MoveClient,
	MoveError,
	NameTeamInput,
	RematchInput
} from "@/swish/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

/** The host services an engine asks for, all of which this object supplies. */
type SwishHostServices = SwishStorage | SwishSync | SwishOutbox | SwishTimers;

/**
 * The Durable Object body every game shares: the engine, with its four host
 * services bound to this object's own storage, its sockets, its alarm and the
 * outbox queue, wrapped in the auth-gated WebSocket base.
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
	const queue = yield* Cloudflare.Queues.WriteQueue( OutboxQueue );

	return yield* WebSocketDurableObject(
		engine.pipe(
			Effect.provide( [
				SwishStorageLive,
				SwishSyncLive,
				SwishTimersLive,
				SwishOutboxLive( queue )
			] )
		)
	);
} ).pipe(
	Effect.provide( SessionServiceLive ),
	Effect.provide( SessionStoreLive ),
	Effect.provide( Cloudflare.KV.ReadWriteNamespaceBinding ),
	Effect.provide( Cloudflare.Queues.WriteQueueBinding )
);


// --- Engine client -----------------------------------------------------------

export const makeApiHandlers = <View, Moves extends BaseMoveClientShape, Config extends BaseGameConfig>(
	game: string,
	moves: Array<keyof Moves>,
	getClient: ( gameId: GameId ) => EngineClient<View, Moves, Config>
) => Effect.gen( function* () {
	const database = yield* SwishDatabase;
	const archive = yield* SwishArchive;

	const createGame = ( payload?: Partial<Config> ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const playerInfo = toPlayerInfo( user );

			const table = yield* database.createGame( game );
			yield* database.seatPlayers( table.id, [ playerInfo ] );

			const code = GameCode.make( generateGameCode() );
			const gameId = GameId.make( table.id );
			const client = getClient( gameId );

			yield* client.initialize( { id: gameId, code, creator: playerInfo.id, config: payload } );
			yield* client.join( playerInfo );

			return GameRef.make( { id: gameId, code } );
		} );

	const getView = ( { gameId }: GameIdParams ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const playerInfo = toPlayerInfo( user );

			const address = GameAddress.make( { game, id: gameId } );
			const row = yield* database.findGame( address );
			if ( row.completed ) {
				const filed = yield* archive.load<ArchivedGame<View, Config>>( address );

				if ( Option.isSome( filed ) ) {
					const { playerViews, view, ...header } = filed.value;
					return {
						...header,
						view: playerViews[ playerInfo.id ] ?? view,
						autoPlay: {}
					} satisfies GameView<View, Config>;
				}
			}

			return yield* getClient( address.id ).getView( playerInfo.id );
		} );

	const joinGame = ( payload: JoinGameInput ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const player = toPlayerInfo( user );

			const table = yield* database.findGameByCode( game, payload.code );
			if ( !table ) {
				return yield* new GameNotFound( { code: payload.code } );
			}

			const gameId = GameId.make( table.id );
			const ref = yield* getClient( gameId ).join( player );
			yield* database.seatPlayers( gameId, [ player ] );

			return ref;
		} );

	const addBots = ( { gameId }: GameIdParams ) => Effect.gen( function* () {
		const { user } = yield* AuthContext;
		const playerInfo = toPlayerInfo( user );

		const address = GameAddress.make( { game, id: gameId } );
		yield* database.findGame( address );

		yield* getClient( address.id ).addBots( playerInfo.id );
	} );

	const joinTeam = ( { gameId }: GameIdParams, input: JoinTeamInput ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const playerInfo = toPlayerInfo( user );

			const address = GameAddress.make( { game, id: gameId } );
			yield* database.findGame( address );

			yield* getClient( address.id ).joinTeam( { input, playerId: playerInfo.id } );
		} );

	const nameTeam = ( { gameId }: GameIdParams, input: NameTeamInput ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const playerInfo = toPlayerInfo( user );

			const address = GameAddress.make( { game, id: gameId } );
			yield* database.findGame( address );

			yield* getClient( address.id ).nameTeam( { input, playerId: playerInfo.id } );
		} );

	const leaveTeam = ( { gameId }: GameIdParams ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const playerInfo = toPlayerInfo( user );

			const address = GameAddress.make( { game, id: gameId } );
			yield* database.findGame( address );

			yield* getClient( address.id ).leaveTeam( playerInfo.id );
		} );

	const startGame = ( { gameId }: GameIdParams ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const playerInfo = toPlayerInfo( user );

			const address = GameAddress.make( { game, id: gameId } );
			yield* database.findGame( address );

			yield* getClient( gameId ).start( playerInfo.id );
		} );

	const autoPlay = ( { gameId }: GameIdParams, input: AutoPlayInput ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const playerInfo = toPlayerInfo( user );

			const address = GameAddress.make( { game, id: gameId } );
			yield* database.findGame( address );

			yield* getClient( gameId ).autoPlay( { input, playerId: playerInfo.id } );
		} );

	const undo = ( { gameId }: GameIdParams ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const playerInfo = toPlayerInfo( user );

			const address = GameAddress.make( { game, id: gameId } );
			yield* database.findGame( address );

			yield* getClient( gameId ).undo( playerInfo.id );
		} );

	const redo = ( { gameId }: GameIdParams ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const playerInfo = toPlayerInfo( user );

			const address = GameAddress.make( { game, id: gameId } );
			yield* database.findGame( address );

			yield* getClient( gameId ).redo( playerInfo.id );
		} );

	const rematch = ( { gameId }: GameIdParams, input: RematchInput ) =>
		Effect.gen( function* () {
			const { user } = yield* AuthContext;
			const playerInfo = toPlayerInfo( user );

			const address = GameAddress.make( { game, id: gameId } );
			yield* database.findGame( address );

			const previous = getClient( address.id );
			const source = yield* previous.getView( playerInfo.id );
			if ( source.status !== "COMPLETED" ) {
				return yield* new RematchUnavailable( { status: source.status } );
			}

			const plan = planRematch( source, input.keepTeams );
			const ref = yield* database.claimRematch( game, address.id );

			if ( !ref ) {
				const existing = yield* database.findRematch( game, address.id );

				if ( !existing ) {
					return yield* new GameNotFound( { id: address.id } );
				}

				return existing;
			}

			yield* database.seatPlayers(
				ref.id,
				plan.players.filter( player => !player.isBot )
			);

			const next = getClient( ref.id );
			yield* next.initialize( { ...ref, creator: playerInfo.id, config: source.config } );

			const sides = new Map( plan.teams.map( seat => [ seat.playerId, seat.team ] ) );
			for ( const player of plan.players ) {
				yield* next.join( player ).pipe( Effect.orDie );

				const team = sides.get( player.id );
				if ( team ) {
					yield* next.joinTeam( { input: { team }, playerId: player.id } ).pipe( Effect.orDie );
				}
			}

			for ( const { by: playerId, ...input } of plan.teamNames ) {
				yield* next.nameTeam( { input, playerId } ).pipe( Effect.orDie );
			}

			yield* previous.setRematch( { input: ref, playerId: playerInfo.id } ).pipe( Effect.orDie );

			return ref;
		} );

	const moveHandlers = moves.reduce(
		( acc, move ) => {
			acc[ move ] = ( { gameId }: GameIdParams, input: Moves[keyof Moves] ) =>
				Effect.gen( function* () {
					const { user } = yield* AuthContext;
					const playerInfo = toPlayerInfo( user );

					const address = GameAddress.make( { game, id: gameId } );
					yield* database.findGame( address );

					const moveClientHandler = getClient( gameId )[ move ] as MoveClient<Moves>[keyof Moves];
					yield* moveClientHandler( { input, playerId: playerInfo.id } );
				} );

			return acc;
		},
		{} as {
			[K in keyof Moves]: (
				params: GameIdParams,
				input: Moves[K]
			) => Effect.Effect<void, MoveError, AuthContext>;
		}
	);

	return {
		createGame,
		getView,
		joinGame,
		addBots,
		joinTeam,
		nameTeam,
		leaveTeam,
		startGame,
		autoPlay,
		undo,
		redo,
		rematch,
		...moveHandlers
	};
} );
