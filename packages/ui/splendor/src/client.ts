import { getClient, run } from "@s2h/contract/client";
import type {
	Gem,
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	Tokens
} from "@s2h/schema/splendor";
import {
	GameCode,
	GameId,
	GameIdParams,
	JoinGameInput,
	playerAudience,
	PlayerInfo
} from "@s2h/swish/schema";

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
const gameIdParams = ( gameId: string ) => GameIdParams.make( { gameId: GameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createSplendorGameFn = ( config: SplendorConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinSplendorGameFn = ( code: string, playerInfo: PlayerInfo ) =>
	run( client.join( {
		payload: JoinGameInput.make( { code: GameCode.make( code ), playerInfo } )
	} ) );

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

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId ),
		payload: playerAudience( playerInfo.id )
	} ), signal );
