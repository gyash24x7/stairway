import { type Config, names } from "unique-names-generator";

export class Constants {
	public static readonly AUTH_USER = "authInfo";
	public static readonly LITERATURE = "literature";
	public static readonly MAX_ASK_WEIGHT = 720;
}

export class GameEvents {
	public static readonly PLAYER_JOINED = "player-joined";
	public static readonly TEAMS_CREATED = "teams-created";
	public static readonly STATUS_UPDATED = "status-updated";
	public static readonly CARD_ASKED = "card-asked";
	public static readonly SET_CALLED = "set-called";
	public static readonly TURN_UPDATED = "turn-updated";
	public static readonly TURN_TRANSFERRED = "turn-transferred";
	public static readonly SCORE_UPDATED = "score-updated";
	public static readonly CARD_COUNT_UPDATED = "card-count-updated";
	public static readonly GAME_COMPLETED = "game-completed";
	// Player Specific Events
	public static readonly CARDS_DEALT = "cards-dealt";
}

export class Messages {
	public static readonly GAME_NOT_FOUND = "Game Not Found!";
	public static readonly INCORRECT_STATUS = "Game is in incorrect status!";
	public static readonly PLAYER_OUT_OF_TURN = "It is not your turn!";
	public static readonly GAME_ALREADY_HAS_REQUIRED_PLAYERS = "The Game already has required players!";
	public static readonly GAME_DOESNT_HAVE_ENOUGH_PLAYERS = "The Game doesn't have enough players!";
	public static readonly USER_ALREADY_PART_OF_GAME = "The User is already part of the Game!";
	public static readonly PLAYER_NOT_PART_OF_GAME = "The Player is not part of the Game!";
	public static readonly ASKED_PLAYER_FROM_SAME_TEAM = "The asked player is from the same team!";
	public static readonly ASKED_CARD_WITH_ASKING_PLAYER = "The asked card is with asking player itself!";
	public static readonly DIDNT_CALL_OWN_CARDS = "Calling Player did not call own cards!";
	public static readonly MULTIPLE_SETS_CALLED = "Cards Called from multiple sets!";
	public static readonly SET_CALLED_WITHOUT_CARDS = "Set called without cards from that set!";
	public static readonly SET_CALLED_FROM_MULTIPLE_TEAMS = "Set called from multiple teams!";
	public static readonly ALL_CARDS_NOT_CALLED = "All Cards not called for the set!";
	public static readonly TRANSFER_AFTER_SUCCESSFUL_CALL = "Turn can only be transferred after a successful call!";
	public static readonly NO_CARDS_WITH_RECEIVING_PLAYER = "Turn can only be transferred to a player with cards!";
	public static readonly TRANSFER_TO_OPPONENT_TEAM = "Turn can only be transferred to member of your team!";
	public static readonly CARD_NOT_PART_OF_GAME = "Card Not Part of Game!";
}

export const namesConfig: Config = {
	dictionaries: [ names ],
	separator: " ",
	length: 1
};
