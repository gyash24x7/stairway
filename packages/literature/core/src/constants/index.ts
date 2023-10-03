export class Constants {
	public static readonly ACTIVE_GAME = "activeGame";
	public static readonly AUTH_INFO = "authInfo";
	public static readonly STATUS_KEY = "requiredStatus";
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
}
