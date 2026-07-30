import { getClient, run } from "@/contract/client";
import type { CallbreakConfig, DeclareWinsInput, PlayCardInput } from "@/games/callbreak/shared/schema";
import { GameCode, GameIdParams, JoinGameInput, playerAudience, PlayerId } from "@/schema/swish";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL );

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createCallbreakGameFn = ( config: CallbreakConfig, signal?: AbortSignal ) =>
	run( client.callbreak.createGame( { payload: config } ), signal );

export const joinCallbreakGameFn = ( code: string, signal?: AbortSignal ) =>
	run(
		client.callbreak.join( {
			payload: JoinGameInput.make( {
				code: GameCode.make( code )
			} )
		} ),
		signal
	);

export const addBotsFn = ( gameId: string, signal?: AbortSignal ) =>
	run( client.callbreak.addBots( { params: gameIdParams( gameId ) } ), signal );

export const declareWinsFn = ( gameId: string, input: DeclareWinsInput, signal?: AbortSignal ) =>
	run(
		client.callbreak.declareWins( {
			params: gameIdParams( gameId ),
			payload: { input }
		} ),
		signal
	);

export const playCardFn = ( gameId: string, input: PlayCardInput, signal?: AbortSignal ) =>
	run(
		client.callbreak.playCard( {
			params: gameIdParams( gameId ),
			payload: { input }
		} ),
		signal
	);

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerId: string, signal?: AbortSignal ) =>
	run(
		client.callbreak.getState( {
			params: gameIdParams( gameId ),
			payload: playerAudience( PlayerId.make( playerId ) )
		} ),
		signal
	);
