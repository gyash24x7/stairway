import type { PlayingCard } from "@stairway/cards";
import type {
	CallBreakCardMapping,
	CallBreakDeal,
	CallBreakGame,
	CallBreakPlayer,
	CallBreakRound,
	CallBreakStatus
} from "@stairway/prisma";

export namespace Callbreak {
	export type Player = CallBreakPlayer
	export type CardMapping = CallBreakCardMapping
	export type Game = CallBreakGame
	export type Deal = CallBreakDeal
	export type Round = CallBreakRound
	export type Status = CallBreakStatus

	export type PlayerData = Record<string, Player>;
	export type DealWithRounds = Deal & { rounds: Round[] };

	export type GameEvent =
		"player-joined"
		| "all-players-joined"
		| "deal-created"
		| "deal-win-declared"
		| "all-deal-wins-declared"
		| "round-created"
		| "card-played"
		| "round-completed"
		| "deal-completed"
		| "status-updated"
		| "game-completed";

	export type PlayerEvent = "cards-dealt";

	export type GameEventPayloads = {
		"player-joined": Player;
		"all-players-joined": Game;
		"deal-created": Deal;
		"deal-win-declared": { deal: Deal; by: Player; wins: number };
		"all-deal-wins-declared": Deal;
		"round-created": Round;
		"card-played": { round: Round; by: string; card: string };
		"round-completed": { round: Round; winner: Player; deal: Deal };
		"deal-completed": { deal: Deal; score: Record<string, number>; };
		"status-updated": Status;
		"game-completed": Game;
	}

	export type PlayerEventPayloads = {
		"cards-dealt": PlayingCard[];
	}

	export type ClientEvent<E extends GameEvent | PlayerEvent> = {
		event: E;
		data: E extends GameEvent
			? GameEventPayloads[E]
			: E extends PlayerEvent
				? PlayerEventPayloads[E]
				: never;
	}

	export type ClientEvents = ClientEvent<"player-joined">
		| ClientEvent<"all-players-joined">
		| ClientEvent<"deal-created">
		| ClientEvent<"cards-dealt">
		| ClientEvent<"deal-win-declared">
		| ClientEvent<"all-deal-wins-declared">
		| ClientEvent<"round-created">
		| ClientEvent<"card-played">
		| ClientEvent<"round-completed">
		| ClientEvent<"deal-completed">
		| ClientEvent<"status-updated">
		| ClientEvent<"game-completed">
}
