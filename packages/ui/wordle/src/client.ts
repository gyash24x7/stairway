// Data-access layer for the Wordle UI.
//
// Thin, typed helpers over the Effect v4 `HttpApiClient` returned by
// `getClient()` (`@s2h/api/client`). Every helper builds the endpoint's
// `{ params, payload }` request, runs the returned `Effect` with
// `Effect.runPromise`, and hands the decoded success value back to TanStack
// Query. Components never touch `getClient` or `Effect` directly.
//
// Call convention (the reference pattern for sibling game UIs):
//   - params + payload endpoints: client.<game>.<ep>( { params, payload } )
//     `params` is the decoded path-param struct (a TaggedStruct, built with
//     `<Schema>.make( … )`); `payload` is the decoded body struct.
//   - payload-only endpoints:     client.<game>.<ep>( { payload } )
//   - each call returns Effect<Success, …>; `Effect.runPromise` yields Success.

import { getClient, run } from "@s2h/api/client";
import { GameCode, GameIdParams, PlayerId, PlayerInfo } from "@s2h/swish/schema";
import type { AuthInfo } from "@s2h/utils/auth";
import type { WordleConfig, WordleData, WordleSnapshot } from "@s2h/wordle/schema";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).wordle;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createWordleGameFn = ( config: WordleConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinWordleGameFn = ( code: string, playerInfo: PlayerInfo ) =>
	run( client.join( {
		payload: { _tag: "swish/JoinGameInput", code: GameCode.make( code ), playerInfo }
	} ) );

export const startWordleFn = ( gameId: string ) =>
	run( client.start( { params: gameIdParams( gameId ) } ) );

export const addBotsFn = ( gameId: string ) =>
	run( client.addBots( { params: gameIdParams( gameId ) } ) );

export const submitGuessFn = ( gameId: string, playerInfo: PlayerInfo, guess: string ) =>
	run( client.guess( {
		params: gameIdParams( gameId ),
		payload: { playerInfo, input: { guess } }
	} ) );

export const undoFn = ( gameId: string, playerInfo: PlayerInfo ) =>
	run( client.undo( { params: gameIdParams( gameId ), payload: playerInfo } ) );

export const redoFn = ( gameId: string, playerInfo: PlayerInfo ) =>
	run( client.redo( { params: gameIdParams( gameId ), payload: playerInfo } ) );

// --- Queries ---------------------------------------------------------------

export const getWordleStateFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
	run( client.getState( { params: gameIdParams( gameId ), payload: playerInfo } ), signal );

// --- Adapters --------------------------------------------------------------
// The new HTTP surface returns lifecycle-generic `GameSnapshot`s and takes a
// `PlayerInfo` where the old oRPC surface returned a game-specific `WordleData`
// and inferred the player from the session. These two adapters bridge that gap
// (the reference pattern each sibling game UI repeats with its own snapshot).

/** Turn the logged-in `AuthInfo` into the `PlayerInfo` payload the API expects. */
export const toPlayerInfo = ( authInfo: AuthInfo ): PlayerInfo =>
	PlayerInfo.make( {
		id: PlayerId.make( authInfo.id ),
		name: authInfo.name,
		avatar: authInfo.avatar,
		isBot: false
	} );

/**
 * Reconcile a wire `WordleSnapshot` with the `WordleData` the components read.
 * The snapshot now carries `config` alongside `shared` + `player`, so this is a
 * straight field map (the reference pattern each sibling game UI repeats).
 */
export const snapshotToWordleData = ( snapshot: WordleSnapshot ): WordleData => ( {
	id: snapshot.id,
	code: snapshot.code,
	players: snapshot.players,
	status: snapshot.status,
	context: snapshot.context,
	config: snapshot.config,
	shared: snapshot.shared,
	player: snapshot.player
} );
