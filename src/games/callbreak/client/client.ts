import { getClient, run } from "@/client.ts";
import type {
	CallbreakCreateInput,
	DeclareWinsInput,
	PlayCardInput
} from "@/games/callbreak/shared/schema.ts";
import {
	GameCode,
	GameIdParams,
	JoinGameInput
} from "@/shared/swish/schema.ts";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL );

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createCallbreakGameFn = ( input: CallbreakCreateInput, signal?: AbortSignal ) =>
	run( client.callbreak.createGame( { payload: input } ), signal );

export const joinCallbreakGameFn = ( code: string, signal?: AbortSignal ) =>
	run(
		client.callbreak.join( {
			payload: JoinGameInput.make( {
				code: GameCode.make( code )
			} )
		} ),
		signal
	);

/** Start a filled game sitting at `PLAYERS_READY`. */
export const startGameFn = ( gameId: string ) =>
	run( client.callbreak.start( { params: gameIdParams( gameId ) } ) );

export const addBotsFn = ( gameId: string, signal?: AbortSignal ) =>
	run( client.callbreak.addBots( { params: gameIdParams( gameId ) } ), signal );

export const declareWinsFn = ( gameId: string, input: DeclareWinsInput, signal?: AbortSignal ) =>
	run(
		client.callbreak.declareWins( {
			params: gameIdParams( gameId ),
			payload: input
		} ),
		signal
	);

export const playCardFn = ( gameId: string, input: PlayCardInput, signal?: AbortSignal ) =>
	run(
		client.callbreak.playCard( {
			params: gameIdParams( gameId ),
			payload: input
		} ),
		signal
	);

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, signal?: AbortSignal ) =>
	run(
		client.callbreak.getState( {
			params: gameIdParams( gameId )
		} ),
		signal
	);
