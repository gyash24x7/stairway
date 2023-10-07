import { ApiResponse, getRequest, postRequest, putRequest } from "@s2h/client";
import type {
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	JoinGameInput,
	PlayerSpecificGameData,
	TransferChanceInput
} from "@literature/data";

export const gamesPath = ( id?: string ) => `/literature/games${ !!id ? "/" + id : "" }`;
export const createGamePath = () => gamesPath();
export const joinGamePath = () => gamesPath() + "/join";
export const createTeamsPath = ( id: string ) => gamesPath( id ) + "/create-teams";
export const startGamePath = ( id: string ) => gamesPath( id ) + "/start";
export const askCardPath = ( id: string ) => gamesPath( id ) + "/ask-card";
export const callSetPath = ( id: string ) => gamesPath( id ) + "/call-set";
export const transferChancePath = ( id: string ) => gamesPath( id ) + "/transfer-chance";
export const getGamePath = ( id: string ) => gamesPath( id );

export const createGame = ( data: CreateGameInput ): Promise<{ id: string }> => postRequest( createGamePath(), data );
export const joinGame = ( data: JoinGameInput ): Promise<{ id: string }> => postRequest( joinGamePath(), data );
export const createTeams = ( id: string, data: CreateTeamsInput ): Promise<ApiResponse> => putRequest(
	createTeamsPath( id ),
	data
);
export const startGame = ( id: string ): Promise<ApiResponse> => putRequest( startGamePath( id ), {} );
export const askCard = ( id: string, data: AskCardInput ): Promise<AskCardInput> => putRequest(
	askCardPath( id ),
	data
);
export const callSet = ( id: string, data: CallSetInput ): Promise<ApiResponse> => putRequest(
	callSetPath( id ),
	data
);
export const transferChance = ( id: string, data: TransferChanceInput ): Promise<ApiResponse> => putRequest(
	transferChancePath( id ),
	data
);

export const getGame = ( id: string ) => getRequest<PlayerSpecificGameData>( getGamePath( id ) );