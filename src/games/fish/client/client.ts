import { getClient, run } from "@/contract/client";
import type {
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	TransferTurnInput
} from "@/games/fish/shared/schema";
import { GameCode, GameIdParams, JoinGameInput, playerAudience, PlayerId } from "@/schema/swish";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).fish;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Lifecycle -------------------------------------------------------------

export const createFishGameFn = ( config: FishConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinFishGameFn = ( code: string ) =>
	run( client.join( {
		payload: JoinGameInput.make( { code: GameCode.make( code ) } )
	} ) );

export const addBotsFn = ( gameId: string ) =>
	run( client.addBots( { params: gameIdParams( gameId ) } ) );

// --- Moves -----------------------------------------------------------------

export const createTeamsFn = ( gameId: string, input: CreateTeamsInput ) =>
	run( client.createTeams( { params: gameIdParams( gameId ), payload: { input } } ) );

export const askCardFn = ( gameId: string, input: AskCardInput ) =>
	run( client.askCard( { params: gameIdParams( gameId ), payload: { input } } ) );

export const claimBookFn = ( gameId: string, input: ClaimBookInput ) =>
	run( client.claimBook( { params: gameIdParams( gameId ), payload: { input } } ) );

export const transferTurnFn = ( gameId: string, input: TransferTurnInput ) =>
	run( client.transferTurn( { params: gameIdParams( gameId ), payload: { input } } ) );

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerId: string, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId ),
		payload: playerAudience( PlayerId.make( playerId ) )
	} ), signal );
