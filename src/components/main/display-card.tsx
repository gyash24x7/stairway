import type { CardRank, CardSet, CardSuit } from "@/libs/cards/types";
import { cn } from "@/utils/cn";

export interface DisplayCardProps {
	rank: CardRank;
	suit: CardSuit;
	focused?: boolean;
}

export const suitIconMap: Record<CardSuit, string> = {
	Clubs: "♣",
	Spades: "♠",
	Hearts: "♥",
	Diamonds: "♦"
};

export const rankTextMap: Record<CardRank, string> = {
	Ace: "A", Two: "2", Ten: "10", Three: "3", Five: "5", Four: "4", Seven: "7", Six: "6",
	Eight: "8", Nine: "9", Jack: "J", Queen: "Q", King: "K"
};

function isRed( suit: CardSuit ) {
	return suit === "Hearts" || suit === "Diamonds";
}

export function DisplayCardSet( { cardSet }: { cardSet: CardSet } ) {
	const cardSetPosition = cardSet.split( " " )[ 0 ];
	const cardSuit = cardSet.split( " " )[ 1 ] as CardSuit;

	return (
		<div className={ "flex gap-3 items-center" }>
			<h1 className={ cn( isRed( cardSuit ) ? "text-red-600" : "text-gray-800", "text-xl font-semibold" ) }>
				{ cardSetPosition.toUpperCase() }
			</h1>
			<div className={ `text-center text-2xl ${ isRed( cardSuit ) ? "text-red-600" : "text-black" }` }>
				{ suitIconMap[ cardSuit ] }
			</div>
		</div>
	);
}


export function DisplayCardSuit( { suit }: { suit: CardSuit } ) {
	return (
		<div className={ `text-center text-2xl ${ isRed( suit ) ? "text-red-600" : "text-black" }` }>
			{ suitIconMap[ suit ] }
		</div>
	);
}

export function DisplayCard( { rank, suit, focused }: DisplayCardProps ) {
	return (
		<div
			className={ cn(
				`w-16 rounded-lg flex flex-col justify-between p-2 text-xl border-2 bg-bg`,
				focused && "bg-white"
			) }
		>
			<div className={ `text-left ${ isRed( suit ) ? "text-red-600" : "text-black" }` }>
				{ rankTextMap[ rank ] }
			</div>
			<div className={ `text-center text-4xl ${ isRed( suit ) ? "text-red-600" : "text-black" }` }>
				{ suitIconMap[ suit ] }
			</div>
			<div className={ `text-right ${ isRed( suit ) ? "text-red-600" : "text-black" }` }>
				{ rankTextMap[ rank ] }
			</div>
		</div>
	);
}