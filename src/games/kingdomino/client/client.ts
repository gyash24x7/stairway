import { getClient, run } from "@/client.ts";
import type {
	DiscardDominoInput,
	KingdominoConfig,
	PlaceDominoInput,
	SelectDominoInput
} from "@/games/kingdomino/shared/schema.ts";
import type {
	PlayerInfo
} from "@/shared/swish/schema.ts";
import {
	GameCode,
	GameIdParams,
	JoinGameInput,
	playerAudience
} from "@/shared/swish/schema.ts";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).kingdomino;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createKingdominoGameFn = ( config: KingdominoConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinKingdominoGameFn = ( code: string ) =>
	run( client.join( { payload: JoinGameInput.make( { code: GameCode.make( code ) } ) } ) );

export const selectDominoFn = ( gameId: string, input: SelectDominoInput ) =>
	run( client.selectDomino( { params: gameIdParams( gameId ), payload: { input } } ) );

export const placeDominoFn = ( gameId: string, input: PlaceDominoInput ) =>
	run( client.placeDomino( { params: gameIdParams( gameId ), payload: { input } } ) );

export const discardDominoFn = ( gameId: string, input: DiscardDominoInput ) =>
	run( client.discardDomino( { params: gameIdParams( gameId ), payload: { input } } ) );

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
