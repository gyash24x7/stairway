import type { CARD_RANKS, CARD_SETS, CARD_SUITS } from "@/libs/cards/constants";

export type CardRank = typeof CARD_RANKS[keyof typeof CARD_RANKS];
export type CardSuit = typeof CARD_SUITS[keyof typeof CARD_SUITS];
export type CardSet = typeof CARD_SETS[keyof typeof CARD_SETS];
export type CardId = `${ CardRank }${ CardSuit }`;
export type CardDisplay = `${ CardRank } of ${ CardSuit }`;

export type PlayingCard = {
	rank: CardRank;
	suit: CardSuit;
}
