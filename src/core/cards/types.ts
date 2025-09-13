import type { CARD_RANKS, CARD_SUITS } from "@/core/cards/constants";
import { customSchema } from "@/utils/schema";
import { object } from "valibot";

export type CardRank = typeof CARD_RANKS[keyof typeof CARD_RANKS];
export type CardSuit = typeof CARD_SUITS[keyof typeof CARD_SUITS];
export type CardId = `${ CardRank }${ CardSuit }`;
export type CardDisplay = `${ keyof typeof CARD_RANKS } OF ${ keyof typeof CARD_SUITS }`;

export type PlayingCard = {
	rank: CardRank;
	suit: CardSuit;
}

export const playingCardSchema = object( {
	rank: customSchema<CardRank>(),
	suit: customSchema<CardSuit>()
} );