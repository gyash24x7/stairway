import type { CardSet, PlayingCard } from "@s2h/cards";
import type { Game, Move, Player, Team } from "@literature/prisma";

export type AskMoveData = {
	from: string;
	by: string;
	card: string;
}

export type CallMoveData = {
	by: string;
	cardSet: CardSet;
	actualCall: Record<string, string>;
	correctCall: Record<string, string>;
}

export type TransferMoveData = {
	from: string;
	to: string;
}

export type AggregatedGameData = Game & {
	players: Record<string, Player>;
	teams: Record<string, Team>;
	cardMappings: Record<string, string>;
	playerList: Player[];
	teamList: Team[];
	moves: Move[];
	hands: Record<string, PlayingCard[]>;
}

export type PlayerSpecificGameData = Game & {
	players: Record<string, Player>;
	myTeam?: Team & { members: string[] };
	oppositeTeam?: Team & { members: string[] };
	hand: PlayingCard[];
	cardCounts: Record<string, number>;
	moves: Move[];
}