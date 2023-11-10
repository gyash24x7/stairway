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

const BASE_URL = "http://localhost:8000/api";

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

const query = <T = any>( path: string ) => fetch( BASE_URL + path, { credentials: "include" } )
	.then<T>( res => res.json() );

const mutation = <T = any>( path: string, data?: any ) => fetch( BASE_URL + path, {
	method: "POST",
	credentials: "include",
	body: !!data ? JSON.stringify( data ) : undefined
} ).then<T>( res => res.json() );

export class LiteratureClient {

	async createGame( data: CreateGameInput ) {
		return mutation<GameData>( createGamePath(), data );
	}

	async joinGame( data: JoinGameInput ) {
		return mutation<GameData>( joinGamePath(), data );
	}

	async addBots( { gameId }: { gameId: string } ) {
		return mutation<PlayerData>( addBotsPath( gameId ), {} );
	}

	async createTeams( { gameId, ...data }: CreateTeamsInput & { gameId: string } ) {
		return mutation<TeamData>( createTeamsPath( gameId ), data );
	}

	async startGame( { gameId }: { gameId: string } ) {
		await mutation( startGamePath( gameId ), {} );
	}

	async askCard( { gameId, ...data }: AskCardInput & { gameId: string } ) {
		return mutation<AskMove>( askCardPath( gameId ), data );
	}

	async callSet( { gameId, ...data }: CallSetInput & { gameId: string } ) {
		return mutation<CallMove>( callSetPath( gameId ), data );
	}

	async transferTurn( { gameId, ...data }: TransferTurnInput & { gameId: string } ) {
		return mutation<TransferMove>( transferTurnPath( gameId ), data );
	}

	async loadGameData( { gameId }: { gameId: string } ) {
		return query<GameData>( getGameDataPath( gameId ) );
	}

	async loadPlayerData( { gameId }: { gameId: string } ) {
		return query<PlayerSpecificData>( getPlayerDataPath( gameId ) );
	}
}

export const literatureClient = new LiteratureClient();
