import type {
	AskCardInput,
	AskMove,
	CallMove,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	JoinGameInput,
	PlayerData,
	PlayerSpecificData,
	TeamData,
	TransferMove,
	TransferTurnInput
} from "@literature/types";
import { ApiResponse, getRequest, postRequest, putRequest } from "@s2h/client";

export const gamesPath = ( id?: string ) => `/literature/games${ !!id ? "/" + id : "" }`;
export const createGamePath = () => gamesPath();
export const joinGamePath = () => gamesPath() + "/join";
export const addBotsPath = ( id: string ) => gamesPath( id ) + "/add-bots";
export const createTeamsPath = ( id: string ) => gamesPath( id ) + "/create-teams";
export const startGamePath = ( id: string ) => gamesPath( id ) + "/start";
export const askCardPath = ( id: string ) => gamesPath( id ) + "/ask-card";
export const callSetPath = ( id: string ) => gamesPath( id ) + "/call-set";
export const transferTurnPath = ( id: string ) => gamesPath( id ) + "/transfer-turn";
export const getGameDataPath = ( id: string ) => gamesPath( id );
export const getPlayerDataPath = ( id: string ) => gamesPath( id ) + "/player";

export class LiteratureClient {

	async createGame( data: CreateGameInput ) {
		return postRequest<GameData>( createGamePath(), data );
	}

	async joinGame( data: JoinGameInput ) {
		return postRequest<GameData>( joinGamePath(), data );
	}

	async addBots( { gameId }: { gameId: string } ) {
		return putRequest<PlayerData>( addBotsPath( gameId ), {} );
	}

	async createTeams( { gameId, ...data }: CreateTeamsInput & { gameId: string } ) {
		return putRequest<TeamData>( createTeamsPath( gameId ), data );
	}

	async startGame( { gameId }: { gameId: string } ) {
		return putRequest<ApiResponse>( startGamePath( gameId ), {} );
	}

	async askCard( { gameId, ...data }: AskCardInput & { gameId: string } ) {
		return putRequest<AskMove>( askCardPath( gameId ), data );
	}

	async callSet( { gameId, ...data }: CallSetInput & { gameId: string } ) {
		return putRequest<CallMove>( callSetPath( gameId ), data );
	}

	async transferTurn( { gameId, ...data }: TransferTurnInput & { gameId: string } ) {
		return putRequest<TransferMove>( transferTurnPath( gameId ), data );
	}

	async loadGameData( { gameId }: { gameId: string } ) {
		return getRequest<GameData>( getGameDataPath( gameId ) );
	}

	async loadPlayerData( { gameId }: { gameId: string } ) {
		return getRequest<PlayerSpecificData>( getPlayerDataPath( gameId ) );
	}
}

export const literatureClient = new LiteratureClient();
