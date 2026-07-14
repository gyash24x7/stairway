// Data-access layer for the Tic-Tac-Toe UI.
//
// Thin, typed helpers over the Effect v4 `HttpApiClient` returned by
// `getClient()` (`@s2h/api/client`). Every helper builds the endpoint's
// `{ params, payload }` request and runs the returned `Effect` with `run(…)`,
// which bridges it to a Promise for TanStack Query (throwing the typed error and
// forwarding the query's `AbortSignal`). Components never touch `getClient`,
// `run`, or `Effect` directly.

import { getClient, run } from "@s2h/api/client";
import { GameCode, GameIdParams, JoinGameInput, PlayerId, PlayerInfo } from "@s2h/swish/schema";
import type { TicTacToeConfig, TicTacToeData, TicTacToeSnapshot } from "@s2h/tictactoe/schema";
import type { AuthInfo } from "@s2h/utils/auth";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL )[ "tic-tac-toe" ];

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createTicTacToeGameFn = ( config: TicTacToeConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinTicTacToeGameFn = ( code: string, playerInfo: PlayerInfo ) =>
	run( client.join( {
		payload: JoinGameInput.make( { code: GameCode.make( code ), playerInfo } )
	} ) );

export const startTicTacToeFn = ( gameId: string ) =>
	run( client.start( { params: gameIdParams( gameId ) } ) );

export const addBotsFn = ( gameId: string ) =>
	run( client.addBots( { params: gameIdParams( gameId ) } ) );

export const placeFn = ( gameId: string, playerInfo: PlayerInfo, position: number ) =>
	run( client.place( {
		params: gameIdParams( gameId ),
		payload: { playerInfo, input: { position } }
	} ) );

export const undoFn = ( gameId: string, playerInfo: PlayerInfo ) =>
	run( client.undo( { params: gameIdParams( gameId ), payload: playerInfo } ) );

export const redoFn = ( gameId: string, playerInfo: PlayerInfo ) =>
	run( client.redo( { params: gameIdParams( gameId ), payload: playerInfo } ) );

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId ),
		payload: playerInfo
	} ), signal );

// --- Adapters --------------------------------------------------------------
// The HTTP surface returns a lifecycle-generic `GameSnapshot` and takes a
// `PlayerInfo` where the old oRPC surface returned a game-specific
// `TicTacToeData` and inferred the player from the session. These adapters
// bridge that gap.

/** Turn the logged-in `AuthInfo` into the `PlayerInfo` payload the API expects. */
export const toPlayerInfo = ( authInfo: AuthInfo ): PlayerInfo =>
	PlayerInfo.make( {
		id: PlayerId.make( authInfo.id ),
		name: authInfo.name,
		avatar: authInfo.avatar,
		isBot: false
	} );

/**
 * Reconcile a wire `TicTacToeSnapshot` with the `TicTacToeData` the components
 * read. The snapshot now carries `config` directly, so every field maps across
 * one-to-one.
 */
export const snapshotToData = ( snapshot: TicTacToeSnapshot ): TicTacToeData => ( {
	id: snapshot.id,
	code: snapshot.code,
	players: snapshot.players,
	status: snapshot.status,
	context: snapshot.context,
	config: snapshot.config,
	shared: snapshot.shared,
	player: snapshot.player
} );
