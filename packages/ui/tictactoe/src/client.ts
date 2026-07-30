import { getClient, run } from "@s2h/contract/client";
import {
	GameCode,
	GameIdParams,
	JoinGameInput,
	playerAudience,
	PlayerInfo
} from "@s2h/schema/swish";
import type { TicTacToeConfig } from "@s2h/schema/tictactoe";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).tictactoe;

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

export const addBotsFn = ( gameId: string ) =>
	run( client.addBots( { params: gameIdParams( gameId ) } ) );

export const placeFn = ( gameId: string, playerInfo: PlayerInfo, position: number ) =>
	run( client.place( {
		params: gameIdParams( gameId ),
		payload: { playerInfo, input: { position } }
	} ) );

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId ),
		payload: playerAudience( playerInfo.id )
	} ), signal );
