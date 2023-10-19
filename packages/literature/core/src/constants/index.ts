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

export class Messages {
	public static readonly GAME_NOT_FOUND = "Game Not Found!";
	public static readonly GAME_NOT_IN_REQUIRED_STATUS = "The Game is not in required status!";
	public static readonly GAME_ALREADY_HAS_REQUIRED_PLAYERS = "The Game already has required players!";
	public static readonly GAME_DOESNT_HAVE_ENOUGH_PLAYERS = "The Game doesn't have enough players!";
	public static readonly USER_ALREADY_PART_OF_GAME = "The User is already part of the Game!";
	public static readonly TEAMS_NOT_CREATED = "The Teams have not been created for the Game!";
	public static readonly PLAYER_NOT_PART_OF_GAME = "The Player is not part of the Game!";
	public static readonly ASKED_PLAYER_FROM_SAME_TEAM = "The asked player is from the same team!";
	public static readonly ASKED_CARD_WITH_ASKING_PLAYER = "The asked card is with asking player itself!";
	public static readonly DIDNT_CALL_OWN_CARDS = "Calling Player did not call own cards!";
	public static readonly MULTIPLE_SETS_CALLED = "Cards Called from multiple sets!";
	public static readonly SET_CALLED_WITHOUT_CARDS = "Set called without cards from that set!";
	public static readonly SET_CALLED_FROM_MULTIPLE_TEAMS = "Set called from multiple teams!";
	public static readonly ALL_CARDS_NOT_CALLED = "All Cards not called for the set!";
	public static readonly TRANSFER_AFTER_SUCCESSFUL_CALL = "Chance can only be transferred after a successful call!";
	public static readonly NO_CARDS_WITH_RECEIVING_PLAYER = "Chance can only be transferred to a player with cards!";
	public static readonly TRANSFER_TO_OPPONENT_TEAM = "Chance can only be transferred to member of your team!";
}