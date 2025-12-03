import type { CARD_RANKS, CARD_SUITS } from "./constants.ts";

export type CardRank = typeof CARD_RANKS[keyof typeof CARD_RANKS];
export type CardSuit = typeof CARD_SUITS[keyof typeof CARD_SUITS];

export type CardId = `${ CardRank }${ CardSuit }`;
export type CardDisplay = `${ keyof typeof CARD_RANKS } OF ${ keyof typeof CARD_SUITS }`;

export type PlayingCard = {
	rank: CardRank;
	suit: CardSuit;
}