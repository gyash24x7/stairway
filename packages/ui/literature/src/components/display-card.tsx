"use client";

import { cn, fjallaOne } from "@base/ui";
import type { CardRank, CardSet, CardSuit } from "@stairway/cards";

export interface DisplayCardProps {
	rank: CardRank;
	suit: CardSuit;
}

export const suitSrcMap: Record<CardSuit, string> = {
	Clubs: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/clubs.png",
	Spades: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/spades.png",
	Hearts: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/hearts.png",
	Diamonds: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/diamonds.png"
};

export const rankTextMap: Record<CardRank, string> = {
	Ace: "A", Two: "2", Ten: "10", Three: "3", Five: "5", Four: "4", Seven: "7", Six: "6",
	Eight: "8", Nine: "9", Jack: "J", Queen: "Q", King: "K"
};

function isRed( suit: CardSuit ) {
	return suit === "Hearts" || suit === "Diamonds";
}

export const DisplayCardSet = ( { cardSet }: { cardSet: CardSet } ) => {
	const cardSetPosition = cardSet.split( " " )[ 0 ];
	const cardSuit = cardSet.split( " " )[ 1 ] as CardSuit;

	return (
		<div className={ "border-2 p-3 rounded-md border-gray-300" }>
			<div className={ "flex gap-3 items-center" }>
				<h1 className={ cn( isRed( cardSuit ) ? "text-red-600" : "text-gray-800", "text-2xl" ) }>
					{ cardSetPosition.toUpperCase() }
				</h1>
				<img src={ suitSrcMap[ cardSuit ] } alt={ cardSet } width={ 32 } height={ 32 }/>
			</div>
		</div>
	);
};

export const DisplayCard = ( { rank, suit }: DisplayCardProps ) => (
	<div className={ "border-2 py-4 px-3 rounded-md border-gray-300 flex flex-col gap-2 items-center w-20" }>
		<h1 className={ cn( isRed( suit ) ? "text-red-600" : "text-gray-800", "text-4xl mb-2", fjallaOne.className ) }>
			{ rankTextMap[ rank ] }
		</h1>
		<img src={ suitSrcMap[ suit ] } alt={ "" } width={ 32 } height={ 32 } className={ "mb-2" }/>
	</div>
);