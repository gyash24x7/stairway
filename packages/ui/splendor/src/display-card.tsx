import { cn } from "@s2h-ui/primitives/utils";
import type { Card, CardLevel, Cost } from "@s2h/splendor/types";
import { gemColors } from "./display-tokens.tsx";

type DisplayCardProps = {
	card: Card;
}

export const levelColors: Record<CardLevel, string> = {
	1: "bg-kiwi text-brown-400",
	2: "bg-mango text-gray-600",
	3: "bg-ice text-amber-400"
};

const levelText: Record<CardLevel, string> = {
	1: "I",
	2: "II",
	3: "III"
};

export function DisplayCard( { card }: DisplayCardProps ) {
	return (
		<div
			className={
				cn(
					"flex flex-col justify-between bg-gray-400 rounded-lg",
					"p-1 gap-0.5 border-2 w-20 h-32 text-neutral-dark",
					"hover:shadow-shadow cursor-pointer transition"
				)
			}
		>
			<div
				className={ cn(
					"flex flex-col-reverse flex-1 rounded-md border overflow-hidden justify-between",
					gemColors[ card.bonus ]
				) }>
				<img
					src={ `/splendor/tokens/${ card.bonus }.svg` }
					className={ cn( "w-8 self-end" ) }
				/>
				<div
					className={
						cn(
							"rounded-br-full rounded-tl-md bg-amber-400 w-6 -px-1 h-6",
							"flex items-center justify-center border-b border-r text-neutral-dark"
						)
					}
				>
					<div className={ "text-sm leading-none -ml-1.5 mb-1" }>
						{ card.points ?? 0 }
					</div>
				</div>
			</div>
			<div className={ "flex flex-wrap gap-0.5" }>
				{ Object.keys( card.cost ).filter( gem => card.cost[ gem as keyof Cost ] > 0 ).map( gem => (
					<div
						key={ gem }
						className={ cn(
							"flex flex-1 rounded-md justify-center items-center min-w-1/4 p-0.5 border",
							gemColors[ gem as keyof Cost ]
						) }
					>
						<span className={ "text-xs" }>{ card.cost[ gem as keyof Cost ] }</span>
					</div>
				) ) }
			</div>
		</div>
	);
}

export function DisplayCardBack( props: { level: CardLevel } ) {
	return (
		<div className={ "w-20 h-32 rounded-lg bg-gray-400 flex items-center justify-center p-1 border-2" }>
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