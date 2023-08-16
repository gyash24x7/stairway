import type { CardSuit, PlayingCard } from "@s2h/cards";

export class CreateGameInput {
	trumpSuit: CardSuit;
}

export class JoinGameInput {
	code: string;
}

export class DeclareWinInput {
	winsDeclared: number;
}

export class RoundMoveInput {
	card: PlayingCard;
}