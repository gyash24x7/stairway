import { cn } from "@s2h-ui/primitives/utils";
import type { Card, CardLevel, Cost } from "@s2h/splendor/types";
import { objectKeys } from "@s2h/utils/array";
import { useStore } from "@tanstack/react-store";
import { handleCardDeSelect, handleCardSelect, store } from "./store.tsx";
import { gemColors } from "./token-picker.tsx";

type DisplayCardProps = {
	card: Card;
	disabled?: boolean;
}

const levelColors: Record<CardLevel, string> = {
	1: "bg-kiwi text-orange-900",
	2: "bg-mango text-gray-600",
	3: "bg-ice text-amber-400"
};

const levelText: Record<CardLevel, string> = {
	1: "I",
	2: "II",
	3: "III"
};

export function DisplayCard( { card, disabled }: DisplayCardProps ) {
	const selectedCard = useStore( store, state => state.local.selectedCard );
	const isSelected = selectedCard === card.id;
	return (
		<div
			className={
				cn(
					"flex flex-col justify-between bg-gray-400 rounded-lg transition",
					"p-1 gap-0.5 border-2 w-16 md:w-20 h-24 md:h-30 text-neutral-dark",
					!disabled && "cursor-pointer",
					!disabled && "hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none",
					isSelected ? "border-accent ring-2 ring-surface shadow-none" : "shadow-shadow"
				)
			}
			onClick={ () => !disabled && ( isSelected ? handleCardDeSelect() : handleCardSelect( card.id ) ) }
		>
			<div
				className={ "flex flex-col flex-1 rounded-md border overflow-hidden justify-between gap-0.5 bg-background" }
			>
				<div className={ "flex justify-between" }>
					<div
						className={
							cn(
								"rounded-br-full rounded-tl-md bg-amber-400 w-5 md:w-6 -px-1 h-5 md:h-6",
								"flex items-center justify-center border-b border-r text-neutral-dark"
							)
						}
					>
						<div className={ "text-sm leading-none -ml-1.5 mb-1" }>
							{ card.points ?? 0 }
						</div>
					</div>
					<img
						src={ `/splendor/tokens/${ card.bonus }.svg` }
						className={ cn( "w-7 md:w-8" ) }
					/>
				</div>
				<div className={ "flex flex-wrap-reverse gap-0.5 p-0.5" }>
					{ objectKeys( card.cost ).filter( gem => card.cost[ gem ] > 0 ).map( gem => (
						<div
							key={ gem }
							className={ cn(
								"flex rounded-full justify-center items-center border w-5 h-5",
								gemColors[ gem as keyof Cost ]
							) }
						>
							<span className={ "text-xs" }>{ card.cost[ gem as keyof Cost ] }</span>
						</div>
					) ) }
				</div>
			</div>
		</div>
	);
}

export function DisplayCardBack( props: { level: CardLevel } ) {
	return (
		<div
			className={ "w-16 md:w-20 h-24 md:h-30 rounded-lg bg-gray-400 flex items-center justify-center p-1 border-2" }>
			<div className={ cn(
				"h-full w-full rounded-md border flex justify-center items-center",
				"text-xl font-bold",
				levelColors[ props.level ]
			) }>
				{ levelText[ props.level ] }
			</div>
		</div>
	);
}