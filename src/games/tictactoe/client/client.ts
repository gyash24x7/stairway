import { getClient, run } from "@/client.ts";
import type { TicTacToeConfig } from "@/games/tictactoe/shared/schema.ts";
import {
	GameCode,
	GameIdParams,
	JoinGameInput
} from "@/shared/swish/schema.ts";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).tictactoe;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createTicTacToeGameFn = ( config: TicTacToeConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinTicTacToeGameFn = ( code: string ) =>
	run( client.join( { payload: JoinGameInput.make( { code: GameCode.make( code ) } ) } ) );

export const addBotsFn = ( gameId: string ) =>
	run( client.addBots( { params: gameIdParams( gameId ) } ) );

export const placeFn = ( gameId: string, position: number ) =>
	run( client.place( { params: gameIdParams( gameId ), payload: { position } } ) );

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId )
	} ), signal );
