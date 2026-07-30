import { getClient, run } from "@s2h/contract/client";
import { GameIdParams, playerAudience, type PlayerInfo } from "@s2h/schema/swish";
import type { WordleConfig } from "@s2h/schema/wordle";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).wordle;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createWordleGameFn = ( config: WordleConfig ) =>
	run( client.createGame( { payload: config } ) );

export const submitGuessFn = ( gameId: string, playerInfo: PlayerInfo, guess: string ) =>
	run( client.guess( {
		params: gameIdParams( gameId ),
		payload: { playerInfo, input: { guess } }
	} ) );

// --- Queries ---------------------------------------------------------------

export const getWordleStateFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId ),
		payload: playerAudience( playerInfo.id )
	} ), signal );
