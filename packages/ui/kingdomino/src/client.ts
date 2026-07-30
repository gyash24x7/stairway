import { getClient, run } from "@s2h/contract/client";
import type {
	DiscardDominoInput,
	KingdominoConfig,
	PlaceDominoInput,
	SelectDominoInput
} from "@s2h/schema/kingdomino";
import {
	GameCode,
	GameIdParams,
	JoinGameInput,
	playerAudience,
	PlayerInfo
} from "@s2h/schema/swish";

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
