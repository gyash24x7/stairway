import type * as schema from "@/callbreak/schema";
import type { PlayingCard } from "@/libs/cards/types";

export namespace Callbreak {
	export type Player = typeof schema.players.$inferSelect;
	export type CardMapping = typeof schema.cardMappings.$inferSelect;
	export type Game = typeof schema.games.$inferSelect;
	export type Deal = typeof schema.deals.$inferSelect;
	export type Round = typeof schema.rounds.$inferSelect;

	export type PlayerData = Record<string, Player>;
	export type DealWithRounds = Deal & { rounds: Round[] };

	export type Event =
		"player-joined"
		| "all-players-joined"
		| "deal-created"
		| "deal-win-declared"
		| "all-deal-wins-declared"
		| "round-created"
		| "card-played"
		| "round-completed"
		| "deal-completed"
		| "game-completed"
		| "cards-dealt";

	export type EventPayloads = {
		"player-joined": Player;
		"all-players-joined": Game;
		"deal-created": Deal;
		"deal-win-declared": { deal: Deal; by: Player; wins: number };
		"all-deal-wins-declared": Deal;
		"round-created": Round;
		"card-played": { round: Round; by: string; card: string };
		"round-completed": { round: Round; winner: Player; deal: Deal };
		"deal-completed": { deal: Deal; score: Record<string, number>; };
		"game-completed": Game;
		"cards-dealt": PlayingCard[];
	}

	export type Context = {
		game: Game;
		players: PlayerData;
	}

	export type Store = {
		playerId: string;
		game: Callbreak.Game;
		players: Callbreak.PlayerData;
		currentDeal?: Callbreak.Deal | null;
		currentRound?: Callbreak.Round | null;
		hand: PlayingCard[];
	}
}

export enum CallbreakEvent {
	PLAYER_JOINED = "player-joined",
	ALL_PLAYERS_JOINED = "all-players-joined",
	DEAL_CREATED = "deal-created",
	DEAL_WIN_DECLARED = "deal-win-declared",
	ALL_DEAL_WINS_DECLARED = "all-deal-wins-declared",
	ROUND_CREATED = "round-created",
	CARD_PLAYED = "card-played",
	ROUND_COMPLETED = "round-completed",
	DEAL_COMPLETED = "deal-completed",
	GAME_COMPLETED = "game-completed",
	CARDS_DEALT = "cards-dealt"
}
