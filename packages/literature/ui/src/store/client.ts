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
import superagent from "superagent";

const BASE_URL = "http://localhost:8000/api/literature";

export class Paths {
	public static readonly JOIN_GAME = "/join";
	public static readonly ADD_BOTS = "/add-bots";
	public static readonly CREATE_TEAMS = "/create-teams";
	public static readonly START_GAME = "/start";
	public static readonly ASK_CARD = "/ask-card";
	public static readonly CALL_SET = "/call-set";
	public static readonly TRANSFER_TURN = "/transfer-turn";
}

export class LiteratureClient {

	async createGame( data: CreateGameInput ) {
		const createGamePath = BASE_URL.concat( "" );
		return superagent.post( createGamePath )
			.send( data )
			.withCredentials()
			.then( res => res.body as GameData );
	}

	async joinGame( data: JoinGameInput ) {
		const joinGamePath = BASE_URL.concat( Paths.JOIN_GAME );
		return superagent.post( joinGamePath )
			.send( data )
			.withCredentials()
			.then( res => res.body as GameData );
	}

	async addBots( { gameId }: { gameId: string } ) {
		const addBotsPath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.ADD_BOTS );
		return superagent.put( addBotsPath )
			.send( {} )
			.withCredentials()
			.then( res => res.body as PlayerData );
	}

	async createTeams( { gameId, ...data }: CreateTeamsInput & { gameId: string } ) {
		const createTeamsPath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.CREATE_TEAMS );
		return superagent.put( createTeamsPath )
			.send( data )
			.withCredentials()
			.then( res => res.body as TeamData );
	}

	async startGame( { gameId }: { gameId: string } ) {
		const startGamePath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.START_GAME );
		await superagent.put( startGamePath ).withCredentials();
	}

	async askCard( { gameId, ...data }: AskCardInput & { gameId: string } ) {
		const askCardPath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.ASK_CARD );
		return superagent.put( askCardPath )
			.send( data )
			.withCredentials()
			.then( res => res.body as AskMove );
	}

	async callSet( { gameId, ...data }: CallSetInput & { gameId: string } ) {
		const callSetPath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.CALL_SET );
		return superagent.put( callSetPath )
			.send( data )
			.withCredentials()
			.then( res => res.body as CallMove );
	}

	async transferTurn( { gameId, ...data }: TransferTurnInput & { gameId: string } ) {
		const transferTurnPath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.TRANSFER_TURN );
		return superagent.put( transferTurnPath )
			.send( data )
			.withCredentials()
			.then( res => res.body as TransferMove );
	}

	async loadGameData( { gameId }: { gameId: string } ) {
		const getGameDataPath = BASE_URL.concat( "/" ).concat( gameId );
		return superagent.get( getGameDataPath )
			.withCredentials()
			.then( res => res.body as { gameData: GameData, playerData: PlayerSpecificData } );
	}
}

export const literatureClient = new LiteratureClient();
