import { CardRank, CardSet, CardSuit, PlayingCard } from "@s2h/cards";
import React from "react";

export interface DisplayCardProps {
    card: PlayingCard;
}

export const suitSrcMap: Record<CardSuit, string> = {
    "Clubs": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/clubs.png",
    "Spades": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/spades.png",
    "Hearts": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/hearts.png",
    "Diamonds": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/diamonds.png"
};

export const cardSetSrcMap: Record<CardSet, string> = {
    "Big Clubs": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/clubs.png",
    "Big Diamonds": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/diamonds.png",
    "Big Hearts": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/hearts.png",
    "Big Spades": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/spades.png",
    "Small Clubs": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/clubs.png",
    "Small Diamonds": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/diamonds.png",
    "Small Hearts": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/hearts.png",
    "Small Spades": "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/spades.png"
};

export const rankTextMap: Record<CardRank, string> = {
    Ace: "A", Two: "2", Ten: "10", Three: "3", Five: "5", Four: "4", Seven: "7", Six: "6",
    Eight: "8", Nine: "9", Jack: "J", Queen: "Q", King: "K"
};

export function DisplayCard( { card }: DisplayCardProps ) {

    const colorClass = card.suit === CardSuit.SPADES || card.suit === CardSuit.CLUBS
        ? "text-dark-700"
        : "text-danger";

    return (
        <div className = { "border border-light-700 rounded rounded-lg bg-light-100 h-24 w-16 pl-2 pt-1m king-yna-bg" }>
            <h2 className = { `font-fjalla text-3xl ${ colorClass }` }>{ rankTextMap[ card.rank ] }</h2>
            <img src = { suitSrcMap[ card.suit ] } alt = { card.id } width = { 16 } height = { 16 } />
        </div>
    );

}