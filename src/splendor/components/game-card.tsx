import { cn } from "@/shared/utils/cn";
import { gemColors } from "@/splendor/components/utils";
import type { Card, CardLevel, Cost } from "@/splendor/core/types";

type GameCardProps = {
	card: Card;
	disabled?: boolean;
	onCardClick?: () => void;
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

export function GameCard( { card, disabled, onCardClick }: GameCardProps ) {
	return (
		<div
			className={ cn(
				"flex flex-col rounded-md overflow-hidden justify-between",
				"w-16 md:w-20 h-24 md:h-30 text-neutral-dark transition",
				"bg-background border-4 border-inverted-surface shadow-shadow",
				!disabled && "cursor-pointer hover:shadow-none",
				!disabled && "hover:translate-x-boxShadowX hover:translate-y-boxShadowY"
			) }
			onClick={ () => !disabled && onCardClick && onCardClick() }
		>
			<div className={ "flex justify-between" }>
				<div
					className={ cn(
						"rounded-br-full rounded-tl-md bg-accent w-5 md:w-6 -px-1 h-5 md:h-6",
						"flex items-center justify-center text-neutral-dark"
					) }
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
			<div className={ "flex flex-wrap-reverse gap-1 p-1" }>
				{ Object.keys( card.cost )
					.map( g => g as keyof Cost )
					.filter( gem => card.cost[ gem ] > 0 )
					.map( gem => (
						<div
							key={ gem }
							className={ cn(
								"flex rounded-full justify-center items-center w-5 h-5",
								"border border-inverted-surface",
								gemColors[ gem ]
							) }
						>
							<span className={ "text-xs" }>{ card.cost[ gem ] }</span>
						</div>
					) ) }
			</div>
		</div>
	);
}

export function GameCardBack( props: { level: CardLevel } ) {
	return (
		<div
			className={ cn(
				"w-16 md:w-20 h-24 md:h-30 rounded-lg",
				"flex justify-center items-center",
				"bg-gray-400 border-4 border-inverted-surface",
				"flex items-center justify-center p-1",
				levelColors[ props.level ],
				"text-xl font-bold"
			) }
		>
			{ levelText[ props.level ] }
		</div>
	);
}