import { getClient, run } from "@/client.ts";
import type { WordleCreateInput } from "@/games/wordle/shared/schema.ts";
import { GameIdParams } from "@/shared/swish/schema.ts";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).wordle;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createWordleGameFn = ( input: WordleCreateInput ) =>
	run( client.createGame( { payload: input } ) );

export const submitGuessFn = ( gameId: string, guess: string ) =>
	run( client.guess( { params: gameIdParams( gameId ), payload: { guess } } ) );

// --- Queries ---------------------------------------------------------------

export const getWordleStateFn = ( gameId: string, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId )
	} ), signal );
