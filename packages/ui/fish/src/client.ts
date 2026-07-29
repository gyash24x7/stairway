import { getClient, run } from "@s2h/contract/client";
import type {
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	TransferTurnInput
} from "@s2h/schema/fish";
import {
	GameCode,
	GameIdParams,
	JoinGameInput,
	playerAudience,
	PlayerInfo
} from "@s2h/swish/schema";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).fish;

/** Build the branded `:gameId` path-param struct the endpoints expect. */
const gameIdParams = ( gameId: string ) =>
	GameIdParams.make( { gameId: GameIdParams.fields.gameId.make( gameId ) } );

// --- Lifecycle -------------------------------------------------------------

export const createFishGameFn = ( config: FishConfig ) =>
	run( client.createGame( { payload: config } ) );

export const joinFishGameFn = ( code: string, playerInfo: PlayerInfo ) =>
	run( client.join( {
		payload: JoinGameInput.make( { code: GameCode.make( code ), playerInfo } )
	} ) );

export const addBotsFn = ( gameId: string ) =>
	run( client.addBots( { params: gameIdParams( gameId ) } ) );

// --- Moves -----------------------------------------------------------------

export const createTeamsFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: CreateTeamsInput
) =>
	run( client.createTeams( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

export const askCardFn = ( gameId: string, playerInfo: PlayerInfo, input: AskCardInput ) =>
	run( client.askCard( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

export const claimBookFn = ( gameId: string, playerInfo: PlayerInfo, input: ClaimBookInput ) =>
	run( client.claimBook( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

export const transferTurnFn = (
	gameId: string,
	playerInfo: PlayerInfo,
	input: TransferTurnInput
) =>
	run( client.transferTurn( { params: gameIdParams( gameId ), payload: { playerInfo, input } } ) );

// --- Queries ---------------------------------------------------------------

export const getStateFn = ( gameId: string, playerInfo: PlayerInfo, signal?: AbortSignal ) =>
	run( client.getState( {
		params: gameIdParams( gameId ),
		payload: playerAudience( playerInfo.id )
	} ), signal );
