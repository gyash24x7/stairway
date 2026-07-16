// Data-access layer for the Splendor UI.
//
// Thin, typed helpers over the Effect v4 `HttpApiClient` returned by
// `getClient()` (`@s2h/api/client`). Every helper builds the endpoint's
// `{ params, payload }` request and runs the returned `Effect` with `run(...)`,
// which bridges Effect -> Promise for TanStack Query (throws the typed error and
// forwards an `AbortSignal`). Components never touch `getClient` or `Effect`.
//
// Call convention (mirrors the reference `@s2h-ui/wordle`):
//   - params + payload endpoints: client.splendor.<ep>( { params, payload } )
//   - payload-only endpoints:     client.splendor.<ep>( { payload } )
//   - path params are the decoded `GameIdParams` struct (built with `.make`).

import { getClient, run } from "@s2h/api/client";
import type {
	Gem,
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	Tokens
} from "@s2h/splendor/schema";
import {
	GameCode,
	GameIdParams,
	JoinGameInput,
	playerAudience,
	PlayerId,
	PlayerInfo
} from "@s2h/swish/schema";
import type { AuthInfo } from "@s2h/utils/auth";

// The wire `PickTokensInput`/`PurchaseCardInput` model their token maps as a
// full `Record<Gem, number>`, but the UI only ever fills the picked/paid gems.
// These accept the `Partial<Tokens>` the components build and cast to the wire
// shape at the boundary (the engine reads the present keys and ignores the rest).
type PickTokensArg = { tokens: Partial<Tokens>; returned?: Partial<Tokens> };
type ReserveCardArg = { cardId: string; withGold: boolean; returnedToken?: Gem };
type PurchaseCardArg = { cardId: string; payment: Partial<Tokens> };

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).splendor;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createSplendorGameFn = ( config: SplendorConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinSplendorGameFn = ( code: string, playerInfo: PlayerInfo ) =>
	run( client.join( {
		payload: JoinGameInput.make( { code: GameCode.make( code ), playerInfo } )
	} ) );

export const startSplendorFn = ( gameId: string ) =>
	run( client.start( { params: gameIdParams( gameId ) } ) );

export const addBotsFn = ( gameId: string ) =>
	run( client.addBots( { params: gameIdParams( gameId ) } ) );

export const pickTokensFn = ( gameId: string, playerInfo: PlayerInfo, input: PickTokensArg ) =>
	run( client.pickTokens( {
		params: gameIdParams( gameId ),
		payload: { playerInfo, input: input as PickTokensInput }
	} ) );

export const reserveCardFn = ( gameId: string, playerInfo: PlayerInfo, input: ReserveCardArg ) =>
	run( client.reserveCard( {
		params: gameIdParams( gameId ),
		payload: { playerInfo, input: input as ReserveCardInput }
	} ) );

export const purchaseCardFn = ( gameId: string, playerInfo: PlayerInfo, input: PurchaseCardArg ) =>
	run( client.purchaseCard( {
		params: gameIdParams( gameId ),
		payload: { playerInfo, input: input as PurchaseCardInput }
	} ) );

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
