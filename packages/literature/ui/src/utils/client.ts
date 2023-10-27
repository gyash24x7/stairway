import type {
	AskCardInput,
	AskMove,
	CallMove,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	JoinGameInput,
	PlayerSpecificData,
	TeamData,
	TransferMove,
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
export const getPlayerPath = ( id: string ) => gamesPath( id ) + "/player";

export function createGame( data: CreateGameInput ) {
	return postRequest<GameData>( createGamePath(), data );
}

export function joinGame( data: JoinGameInput ) {
	return postRequest<GameData>( joinGamePath(), data );
}

export function createTeams( { gameId, ...data }: CreateTeamsInput & { gameId: string } ) {
	return putRequest<TeamData>( createTeamsPath( gameId ), data );
}

export function startGame( { gameId }: { gameId: string } ) {
	return putRequest<ApiResponse>( startGamePath( gameId ), {} );
}

export function askCard( { gameId, ...data }: AskCardInput & { gameId: string } ) {
	return putRequest<AskMove>( askCardPath( gameId ), data );
}

export function callSet( { gameId, ...data }: CallSetInput & { gameId: string } ) {
	return putRequest<CallMove>( callSetPath( gameId ), data );
}

export function transferTurn( { gameId, ...data }: TransferTurnInput & { gameId: string } ) {
	return putRequest<TransferMove>( transferTurnPath( gameId ), data );
}

export function loadGameData( { gameId }: { gameId: string } ) {
	return getRequest<GameData>( getGameDataPath( gameId ) );
}

export function loadPlayerData( { gameId }: { gameId: string } ) {
	return getRequest<PlayerSpecificData>( getPlayerPath( gameId ) );
}