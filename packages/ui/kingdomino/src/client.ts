// Data-access layer for the Kingdomino UI.
//
// Thin, typed helpers over the Effect v4 `HttpApiClient` returned by
// `getClient()` (`@s2h/api/client`). Every helper builds the endpoint's
// `{ params, payload }` request and bridges the returned `Effect` to a Promise
// with `run(...)` (which forwards the query's `AbortSignal` and throws the
// typed endpoint error). Components never touch `getClient`/`Effect` directly.
//
// Call convention (mirrors the reference `@s2h-ui/wordle`):
//   - params + payload endpoints: client.kingdomino.<ep>( { params, payload } )
//     `params` is the decoded `:gameId` path-param struct; `payload` the body.
//   - payload-only endpoints:     client.kingdomino.<ep>( { payload } )
//   - each call returns Effect<Success, …>; `run` yields Success.

import { getClient, run } from "@s2h/api/client";
import {
	GameCode,
	GameIdParams,
	JoinGameInput,
	playerAudience,
	PlayerId,
	PlayerInfo
} from "@s2h/swish/schema";
import type { AuthInfo } from "@s2h/utils/auth";
import type {
	DiscardDominoInput,
	KingdominoConfig,
	PlaceDominoInput,
	SelectDominoInput
} from "@s2h/kingdomino/schema";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).kingdomino;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createKingdominoGameFn = ( config: KingdominoConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinKingdominoGameFn = ( code: string, playerInfo: PlayerInfo ) =>
	run( client.join( {
		payload: JoinGameInput.make( { code: GameCode.make( code ), playerInfo } )
	} ) );

export const startKingdominoFn = ( gameId: string ) =>
	run( client.start( { params: gameIdParams( gameId ) } ) );

export const addBotsFn = ( gameId: string ) =>
	run( client.addBots( { params: gameIdParams( gameId ) } ) );

export const selectDominoFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: SelectDominoInput
) =>
	run( client.selectDomino( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

export const placeDominoFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: PlaceDominoInput
) =>
	run( client.placeDomino( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

export const discardDominoFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: DiscardDominoInput
) =>
	run( client.discardDomino( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

export const undoFn = ( gameId: string, playerInfo: PlayerInfo ) =>
	run( client.undo( { params: gameIdParams( gameId ), payload: playerInfo } ) );

export const redoFn = ( gameId: string, playerInfo: PlayerInfo ) =>
	run( client.redo( { params: gameIdParams( gameId ), payload: playerInfo } ) );

// --- Queries ---------------------------------------------------------------

export const getKingdominoStateFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	signal?: AbortSignal
) =>
	run( client.getState( {
		params: gameIdParams( gameId ),
		payload: playerAudience( playerInfo.id )
	} ), signal );

// --- Adapters --------------------------------------------------------------

/** Turn the logged-in `AuthInfo` into the `PlayerInfo` payload the API expects. */
export const toPlayerInfo = ( authInfo: AuthInfo ): PlayerInfo =>
	PlayerInfo.make( {
		id: PlayerId.make( authInfo.id ),
		name: authInfo.name,
		avatar: authInfo.avatar,
		isBot: false
	} );
