import { cn } from "@s2h-ui/primitives/utils";
import type { CardId, CardSuit } from "@s2h/utils/cards";

function isRed( suit: CardSuit ) {
	return suit === "H" || suit === "D";
}

export function DisplayCardSuit( { suit }: { suit: CardSuit } ) {
	return (
		<div
			className={ cn(
				"text-center text-lg md:text-2xl xl:text-4xl",
				isRed( suit ) ? "text-red-600" : "text-black"
			) }
		>
			{ { C: "♣", S: "♠", H: "♥", D: "♦" }[ suit ] }
		</div>
	);
}

export type DisplayCardProps = { cardId: CardId; focused?: boolean; };

export function DisplayCard( { cardId, focused }: DisplayCardProps ) {
	return (
		<img
			src={ `/cards/${ cardId }.svg` }
			className={ cn(
				"w-16 md:w-20 xl:w-24 rounded-lg border-border border-1",
				focused && "border-components border-2"
			) }
			alt={ cardId }
		/>
	);
}