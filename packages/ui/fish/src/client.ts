// Data-access layer for the Fish (Literature) UI.
//
// Thin, typed helpers over the Effect v4 `HttpApiClient` returned by
// `getClient()` (`@s2h/api/client`). Every helper builds the endpoint's
// `{ params, payload }` request, bridges the returned `Effect` to a Promise
// with `run(...)`, and hands the decoded success value back to TanStack Query.
// Components never touch `getClient` or `Effect` directly.
//
// Call convention (mirrors the reference `@s2h-ui/wordle` client):
//   - params + payload endpoints: client.fish.<ep>( { params, payload } )
//   - payload-only endpoints:     client.fish.<ep>( { payload } )
//   - each call returns Effect<Success, …>; `run(...)` yields Success.

import { getClient, run } from "@s2h/api/client";
import type {
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	TransferTurnInput
} from "@s2h/fish/schema";
import {
	GameCode,
	GameIdParams,
	JoinGameInput,
	playerAudience,
	PlayerId,
	PlayerInfo
} from "@s2h/swish/schema";
import type { AuthInfo } from "@s2h/utils/auth";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).fish;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Lifecycle -------------------------------------------------------------

export const createFishGameFn = ( config: FishConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinFishGameFn = ( code: string, playerInfo: PlayerInfo ) =>
	run( client.join( {
		payload: JoinGameInput.make( { code: GameCode.make( code ), playerInfo } )
	} ) );

export const startFishFn = ( gameId: string ) =>
	run( client.start( { params: gameIdParams( gameId ) } ) );

export const addBotsFn = ( gameId: string ) =>
	run( client.addBots( { params: gameIdParams( gameId ) } ) );

// --- Moves -----------------------------------------------------------------

export const createTeamsFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: CreateTeamsInput
) =>
	run( client.createTeams( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

export const askCardFn = ( gameId: string, playerInfo: PlayerInfo, input: AskCardInput ) =>
	run( client.askCard( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

export const claimBookFn = ( gameId: string, playerInfo: PlayerInfo, input: ClaimBookInput ) =>
	run( client.claimBook( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

export const transferTurnFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: TransferTurnInput
) =>
	run( client.transferTurn( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

export const undoFn = ( gameId: string, playerInfo: PlayerInfo ) =>
	run( client.undo( { params: gameIdParams( gameId ), payload: playerInfo } ) );

export const redoFn = ( gameId: string, playerInfo: PlayerInfo ) =>
	run( client.redo( { params: gameIdParams( gameId ), payload: playerInfo } ) );

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
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
