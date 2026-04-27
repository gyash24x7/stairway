import type { CardId, CardSuit } from "@/shared/utils/cards";
import { cn } from "@/shared/utils/cn";

function isRed( suit: CardSuit ) {
	return suit === "H" || suit === "D";
}

type CardSuitProps = {
	suit: CardSuit;
	large?: boolean;
	themed?: boolean
};

export function RCardSuit( { suit, large, themed }: CardSuitProps ) {
	return (
		<div
			className={ cn(
				"text-center",
				!large && "text-lg md:text-2xl xl:text-4xl",
				themed && "text-foreground",
				!themed && ( isRed( suit ) ? "text-red-600" : "text-black" ),
				large && "text-2xl md:text-4xl"
			) }
		>
			{ { C: "♣", S: "♠", H: "♥", D: "♦" }[ suit ] }
		</div>
	);
}

export type RCardProps = { cardId: CardId; focused?: boolean; };

export function RCard( { cardId, focused }: RCardProps ) {
	return (
		<img
			src={ `/cards/${ cardId }.svg` }
			className={ cn(
				"w-16 h-24 md:w-20 md:h-30 xl:w-24 xl:h-36",
				"rounded-lg border-inverted-surface border",
				focused && "border-2"
			) }
			alt={ cardId }
		/>
	);
}