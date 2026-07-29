import { getClient, run } from "@s2h/contract/client";
import type { CallbreakConfig, DeclareWinsInput, PlayCardInput } from "@s2h/schema/callbreak";
import {
	GameCode,
	GameIdParams,
	JoinGameInput,
	playerAudience,
	PlayerInfo
} from "@s2h/swish/schema";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL );

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Mutations -------------------------------------------------------------

export const createCallbreakGameFn = ( config: CallbreakConfig, signal?: AbortSignal ) =>
	run( client.callbreak.createGame( { payload: config } ), signal );

export const joinCallbreakGameFn = (
	code: string,
	playerInfo: PlayerInfo,
	signal?: AbortSignal
) =>
	run(
		client.callbreak.join( {
			payload: JoinGameInput.make( { code: GameCode.make( code ), playerInfo } )
		} ),
		signal
	);

export const addBotsFn = ( gameId: string, signal?: AbortSignal ) =>
	run( client.callbreak.addBots( { params: gameIdParams( gameId ) } ), signal );

export const declareWinsFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: DeclareWinsInput,
	signal?: AbortSignal
) =>
	run(
		client.callbreak.declareWins( {
			params: gameIdParams( gameId ),
			payload: { playerInfo, input }
		} ),
		signal
	);

export const playCardFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: PlayCardInput,
	signal?: AbortSignal
) =>
	run(
		client.callbreak.playCard( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ),
		signal
	);

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
	run(
		client.callbreak.getState( {
			params: gameIdParams( gameId ),
			payload: playerAudience( playerInfo.id )
		} ),
		signal
	);
