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
import ky from "ky";

const BASE_URL = "http://localhost:8000/api/literature";

type GameDataResponse = { gameData: GameData, playerData: PlayerSpecificData };

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
		return ky.post( createGamePath, { json: data, credentials: "include" } ).json<GameData>();
	}

	async joinGame( data: JoinGameInput ) {
		const joinGamePath = BASE_URL.concat( Paths.JOIN_GAME );
		return ky.post( joinGamePath, { json: data, credentials: "include" } ).json<GameData>();
	}

	async addBots( { gameId }: { gameId: string } ) {
		const addBotsPath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.ADD_BOTS );
		return ky.put( addBotsPath, { credentials: "include" } ).json<PlayerData>();
	}

	async createTeams( { gameId, ...data }: CreateTeamsInput & { gameId: string } ) {
		const createTeamsPath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.CREATE_TEAMS );
		return ky.put( createTeamsPath, { json: data, credentials: "include" } ).json<TeamData>();
	}

	async startGame( { gameId }: { gameId: string } ) {
		const startGamePath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.START_GAME );
		await ky.put( startGamePath, { credentials: "include" } ).json<TeamData>();
	}

	async askCard( { gameId, ...data }: AskCardInput & { gameId: string } ) {
		const askCardPath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.ASK_CARD );
		return ky.put( askCardPath, { json: data, credentials: "include" } ).json<AskMove>();
	}

	async callSet( { gameId, ...data }: CallSetInput & { gameId: string } ) {
		const callSetPath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.CALL_SET );
		return ky.put( callSetPath, { json: data, credentials: "include" } ).json<CallMove>();
	}

	async transferTurn( { gameId, ...data }: TransferTurnInput & { gameId: string } ) {
		const transferTurnPath = BASE_URL.concat( "/" ).concat( gameId ).concat( Paths.TRANSFER_TURN );
		return ky.put( transferTurnPath, { json: data, credentials: "include" } ).json<TransferMove>();
	}

	async loadGameData( { gameId }: { gameId: string } ) {
		const getGameDataPath = BASE_URL.concat( "/" ).concat( gameId );
		return ky.put( getGameDataPath, { credentials: "include" } ).json<GameDataResponse>();
	}
}

export const literatureClient = new LiteratureClient();
