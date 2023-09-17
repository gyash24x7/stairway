export class Constants {
	public static readonly ACTIVE_GAME = "activeGame";
	public static readonly ACTIVE_GAME_HANDS = "activeGameHands";
	public static readonly AUTH_INFO = "authInfo";
}

export class Paths {
	public static readonly BASE = "literature/games";
	public static readonly JOIN_GAME = "join";
	public static readonly CREATE_TEAMS = ":gameId/create-teams";
	public static readonly START_GAME = ":gameId/start";
	public static readonly ASK_CARD = ":gameId/ask-card";
	public static readonly CALL_SET = ":gameId/call-set";
	public static readonly TRANSFER_CHANCE = ":gameId/transfer-chance";

	public static readonly GET_GAME = ":gameId";
	public static readonly GET_GAME_HANDS = ":id/hand";
	public static readonly GET_GAME_MOVES = ":id/moves";
}

export class DbConstants {
	public static readonly LITERATURE_DB = "literature";
	public static readonly GAMES_COLLECTION = "games";
	public static readonly HANDS_COLLECTION = "hands";
	public static readonly MOVES_COLLECTION = "moves";
}
