import { cn } from "@/shared/ui/utils/cn.ts";

import type { CardId, CardSuit } from "@/shared/cards/schema.ts";

function isRed( suit: CardSuit ) {
	return suit === "H" || suit === "D";
}

type CardSuitProps = {
	suit: CardSuit;
	large?: boolean;
	themed?: boolean;
	className?: string;
};

export function RCardSuit( { suit, large, themed, className }: CardSuitProps ) {
	return (
		<div
			className={ cn(
				"text-center",
				!large && "text-lg md:text-2xl xl:text-4xl",
				themed && "text-foreground",
				!themed && ( isRed( suit ) ? "text-red-600" : "text-black" ),
				large && "text-2xl md:text-4xl",
				className
			) }
		>
			{ { C: "♣", S: "♠", H: "♥", D: "♦" }[ suit ] }
		</div>
	);
}

export type RCardProps = {
	cardId: CardId;
	small?: boolean;
	large?: boolean;
};

export function RCard( { cardId, small, large }: RCardProps ) {
	return (
		<img
			src={ `/cards/${ cardId }.svg` }
			className={ cn(
				"w-16 h-24 md:w-20 md:h-30 xl:w-24 xl:h-36",
				"rounded-lg border shrink-0",
				small && "w-12 h-18 md:w-16 md:h-24 xl:w-20 xl:h-30",
				large && "w-28 h-42 md:w-36 md:h-54 xl:w-44 xl:h-66"
			) }
			alt={ cardId }
		/>
	);
}
