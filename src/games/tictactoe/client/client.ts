import { getClient, run } from "@/client.ts";
import type { TicTacToeConfig } from "@/games/tictactoe/shared/schema";
import {
	GameCode,
	GameIdParams,
	JoinGameInput,
	playerAudience,
	PlayerId
} from "@/shared/swish/schema";

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
	run( client.place( { params: gameIdParams( gameId ), payload: { input: { position } } } ) );

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerId: string, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId ),
		payload: playerAudience( PlayerId.make( playerId ) )
	} ), signal );
