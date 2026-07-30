import { getClient, run } from "@/client.ts";
import type { WordleConfig } from "@/games/wordle/shared/schema";
import { GameIdParams, playerAudience, PlayerId } from "@/shared/swish/schema";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).wordle;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createWordleGameFn = ( config: WordleConfig ) =>
	run( client.createGame( { payload: config } ) );

export const submitGuessFn = ( gameId: string, guess: string ) =>
	run( client.guess( { params: gameIdParams( gameId ), payload: { input: { guess } } } ) );

// --- Queries ---------------------------------------------------------------

export const getWordleStateFn = ( gameId: string, playerId: string, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId ),
		payload: playerAudience( PlayerId.make( playerId ) )
	} ), signal );
