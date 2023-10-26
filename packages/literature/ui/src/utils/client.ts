import type {
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	JoinGameInput,
	PlayerSpecificData,
	TransferTurnInput
} from "@literature/types";
import { ApiResponse, getRequest, postRequest, putRequest } from "@s2h/client";

export const gamesPath = ( id?: string ) => `/literature/games${ !!id ? "/" + id : "" }`;
export const createGamePath = () => gamesPath();
export const joinGamePath = () => gamesPath() + "/join";
export const createTeamsPath = ( id: string ) => gamesPath( id ) + "/create-teams";
export const startGamePath = ( id: string ) => gamesPath( id ) + "/start";
export const askCardPath = ( id: string ) => gamesPath( id ) + "/ask-card";
export const callSetPath = ( id: string ) => gamesPath( id ) + "/call-set";
export const transferTurnPath = ( id: string ) => gamesPath( id ) + "/transfer-turn";
export const getGameDataPath = ( id: string ) => gamesPath( id );
export const getPlayerDataPath = ( id: string ) => gamesPath( id ) + "/player-data";

export function createGame( data: CreateGameInput ) {
	return postRequest<{ id: string }>( createGamePath(), data );
}

export function joinGame( data: JoinGameInput ) {
	return postRequest<{ id: string }>( joinGamePath(), data );
}

export function createTeams( { gameId, ...data }: CreateTeamsInput & { gameId: string } ) {
	return putRequest<ApiResponse>( createTeamsPath( gameId ), data );
}

export function startGame( { gameId }: { gameId: string } ) {
	return putRequest<ApiResponse>( startGamePath( gameId ), {} );
}

export function askCard( { gameId, ...data }: AskCardInput & { gameId: string } ) {
	return putRequest<ApiResponse>( askCardPath( gameId ), data );
}

export function callSet( { gameId, ...data }: CallSetInput & { gameId: string } ) {
	return putRequest<ApiResponse>( callSetPath( gameId ), data );
}

export function transferTurn( { gameId, ...data }: TransferTurnInput & { gameId: string } ) {
	return putRequest<ApiResponse>( transferTurnPath( gameId ), data );
}

export function loadGameData( { gameId }: { gameId: string } ) {
	return getRequest<GameData>( getGameDataPath( gameId ) );
}

export function loadPlayerData( { gameId }: { gameId: string } ) {
	return getRequest<PlayerSpecificData>( getPlayerDataPath( gameId ) );
}