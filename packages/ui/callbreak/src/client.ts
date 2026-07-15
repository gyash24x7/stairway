// Data-access layer for the Callbreak UI.
//
// Thin, typed helpers over the Effect v4 `HttpApiClient` returned by
// `getClient()` (`@s2h/api/client`). Every helper builds the endpoint's
// `{ params, payload }` request and bridges the returned `Effect` to a Promise
// with `run()` (which forwards the query's `AbortSignal` and throws the tagged
// endpoint error on failure). Components never touch `getClient` or `Effect`.
//
// Call convention (mirrors the reference `@s2h-ui/wordle` client):
//   - params + payload endpoints: client.<ep>( { params, payload } )
//     `params` is the branded `:gameId` path-param struct (built with
//     `GameIdParams.make( … )`); `payload` is the decoded body struct.
//   - payload-only endpoints:     client.<ep>( { payload } )
//   - void endpoints (start/addBots/moves) still take `{ params, payload }`.

import { getClient, run } from "@s2h/api/client";
import type {
	CallbreakConfig,
	CallbreakSnapshot,
	DeclareWinsInput,
	PlayCardInput
} from "@s2h/callbreak/schema";
import { GameCode, GameIdParams, JoinGameInput, PlayerId, PlayerInfo } from "@s2h/swish/schema";
import type { AuthInfo } from "@s2h/utils/auth";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL );

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createCallbreakGameFn = ( config: CallbreakConfig, signal?: AbortSignal ) =>
	run( client.callbreak.createGame( { payload: config } ), signal );

export const joinCallbreakGameFn = (
	code: string,
	playerInfo: PlayerInfo,
	signal?: AbortSignal
) =>
	run(
		client.callbreak.join( {
			payload: JoinGameInput.make( { code: GameCode.make( code ), playerInfo } )
		} ),
		signal
	);

export const startCallbreakFn = ( gameId: string, signal?: AbortSignal ) =>
	run( client.callbreak.start( { params: gameIdParams( gameId ) } ), signal );

export const addBotsFn = ( gameId: string, signal?: AbortSignal ) =>
	run( client.callbreak.addBots( { params: gameIdParams( gameId ) } ), signal );

export const declareWinsFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: DeclareWinsInput,
	signal?: AbortSignal
) =>
	run(
		client.callbreak.declareWins( {
			params: gameIdParams( gameId ),
			payload: { playerInfo, input }
		} ),
		signal
	);

export const playCardFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: PlayCardInput,
	signal?: AbortSignal
) =>
	run(
		client.callbreak.playCard( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ),
		signal
	);

export const undoFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
	run( client.callbreak.undo( { params: gameIdParams( gameId ), payload: playerInfo } ), signal );

export const redoFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
	run( client.callbreak.redo( { params: gameIdParams( gameId ), payload: playerInfo } ), signal );

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
	run(
		client.callbreak.getState( { params: gameIdParams( gameId ), payload: playerInfo } ),
		signal
	);

// --- Adapters --------------------------------------------------------------
// The new HTTP surface returns a lifecycle-generic `CallbreakSnapshot` and takes
// a `PlayerInfo` where the old oRPC surface returned the game-specific
// `{ shared, player }` shape and inferred the player from the session. These two
// adapters bridge that gap (the reference pattern each sibling game UI repeats).

/** Turn the logged-in `AuthInfo` into the `PlayerInfo` payload the API expects. */
export const toPlayerInfo = ( authInfo: AuthInfo ): PlayerInfo =>
	PlayerInfo.make( {
		id: PlayerId.make( authInfo.id ),
		name: authInfo.name,
		avatar: authInfo.avatar,
		isBot: false
	} );

/**
 * The merged `{ shared, player }` view the Callbreak components read. The
 * snapshot's flat top-level fields (id/code/status/context/players/config) plus
 * the shared view (`snapshot.shared` = scores/activeDeal/…) are folded back into
 * the old shared object where `state` holds the shared view.
 */
export type CallbreakGame = {
	shared: {
		id: CallbreakSnapshot[ "id" ];
		code: CallbreakSnapshot[ "code" ];
		status: CallbreakSnapshot[ "status" ];
		context: CallbreakSnapshot[ "context" ];
		players: CallbreakSnapshot[ "players" ];
		config: CallbreakSnapshot[ "config" ];
		state: CallbreakSnapshot[ "shared" ];
	};
	player: CallbreakSnapshot[ "player" ];
};

/** Reshape a wire `CallbreakSnapshot` into the `{ shared, player }` the UI reads. */
export const snapshotToCallbreakGame = ( snapshot: CallbreakSnapshot ): CallbreakGame => ( {
	shared: {
		id: snapshot.id,
		code: snapshot.code,
		status: snapshot.status,
		context: snapshot.context,
		players: snapshot.players,
		config: snapshot.config,
		state: snapshot.shared
	},
	player: snapshot.player
} );
