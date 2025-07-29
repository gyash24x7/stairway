import type { CARD_RANKS, CARD_SUITS } from "@/libs/cards/constants";

export type CardRank = typeof CARD_RANKS[keyof typeof CARD_RANKS];
export type CardSuit = typeof CARD_SUITS[keyof typeof CARD_SUITS];
export type CardId = `${ CardRank }${ CardSuit }`;
export type CardDisplay = `${ CardRank } of ${ CardSuit }`;

export type PlayingCard = {
	rank: CardRank;
	suit: CardSuit;
}
