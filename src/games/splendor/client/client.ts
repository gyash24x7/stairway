import { getClient, run } from "@/client.ts";
import type {
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig
} from "@/games/splendor/shared/schema.ts";
import {
	GameCode,
	GameId,
	GameIdParams,
	JoinGameInput,
	playerAudience,
	PlayerId
} from "@/shared/swish/schema.ts";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).splendor;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) => GameIdParams.make( { gameId: GameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createSplendorGameFn = ( config: SplendorConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinSplendorGameFn = ( code: string ) =>
	run( client.join( { payload: JoinGameInput.make( { code: GameCode.make( code ) } ) } ) );

export const pickTokensFn = ( gameId: string, input: PickTokensInput ) =>
	run( client.pickTokens( { params: gameIdParams( gameId ), payload: { input } } ) );

export const reserveCardFn = ( gameId: string, input: ReserveCardInput ) =>
	run( client.reserveCard( { params: gameIdParams( gameId ), payload: { input } } ) );

export const purchaseCardFn = ( gameId: string, input: PurchaseCardInput ) =>
	run( client.purchaseCard( { params: gameIdParams( gameId ), payload: { input } } ) );

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerId: string, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId ),
		payload: playerAudience( PlayerId.make( playerId ) )
	} ), signal );
