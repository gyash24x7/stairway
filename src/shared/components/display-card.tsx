import { getCardFromId } from "@/libs/cards/card";
import type { CardRank, CardSet, CardSuit } from "@/libs/cards/types";
import { cn } from "@/shared/utils/cn";

export type DisplayCardProps = { focused?: boolean; rank: CardRank; suit: CardSuit; cardId?: undefined; }
	| { cardId: string; focused?: boolean; rank?: undefined; suit?: undefined; };

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
		<div className={ "flex gap-2 md:gap-3 items-center" }>
			<h1
				className={ cn(
					isRed( cardSuit ) ? "text-red-600" : "text-gray-800",
					"text-md md:text-lg xl:text-xl font-semibold"
				) }
			>
				{ cardSetPosition.toUpperCase() }
			</h1>
			<div className={ cn(
				isRed( cardSuit ) ? "text-red-600" : "text-black",
				"text-center text-lg md:text-xl xl:text-2xl"
			) }
			>
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

export function DisplayCard( { rank, suit, cardId, focused }: DisplayCardProps ) {
	const card = !rank || !suit ? getCardFromId( cardId ) : { rank, suit };

	return (
		<div
			className={ cn(
				"w-12 md:w-14 xl:w-16 p-1 md:p-1.5 xl:p-2",
				`rounded-lg flex flex-col justify-between md:text-lg xl:text-xl border-2 bg-bg`,
				focused && "bg-white"
			) }
		>
			<div className={ cn( "text-left", isRed( card.suit ) ? "text-red-600" : "text-black" ) }>
				{ rankTextMap[ card.rank ] }
			</div>
			<div
				className={ cn(
					"text-center text-lg md:text-2xl xl:text-4xl",
					isRed( card.suit ) ? "text-red-600" : "text-black"
				) }
			>
				{ suitIconMap[ card.suit ] }
			</div>
			<div className={ cn( "text-right", isRed( card.suit ) ? "text-red-600" : "text-black" ) }>
				{ rankTextMap[ card.rank ] }
			</div>
		</div>
	);
}