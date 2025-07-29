import type { CardId, CardSuit } from "@/libs/cards/types";
import { getCardImage } from "@/libs/cards/utils";
import type { FishBook } from "@/libs/fish/types";
import { cn } from "@/shared/utils/cn";

function isRed( suit: CardSuit ) {
	return suit === "H" || suit === "D";
}

export function DisplayBook( { book }: { book: FishBook } ) {
	return (
		<div className={ "flex gap-2 md:gap-3 items-center" }>
			<h1
				className={ cn(
					"text-gray-800",
					"text-md md:text-lg xl:text-xl font-semibold"
				) }
			>
				{ book }
			</h1>
		</div>
	);
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
			src={ getCardImage( cardId ) }
			className={ cn(
				"w-16 md:w-20 xl:w-24 rounded-lg border-border border-1",
				focused && "border-main border-2"
			) }
			alt={ cardId }
		/>
	);
}