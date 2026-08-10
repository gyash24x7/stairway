import type { Card, CardLevel, Cost } from "@/games/splendor/shared/schema.ts";
import { cn } from "@/shared/ui/utils/cn.ts";
import { gemColors } from "@/games/splendor/client/utils.tsx";

type GameCardProps = {
	card: Card;
	disabled?: boolean;
	onCardClick?: () => void;
	/**
	 * Television sizing: the card fills its row's height and takes its width from
	 * the 2:3 aspect, so the board scales to whatever space the couch gives it.
	 */
	large?: boolean;
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

/** Height-driven sizing shared by the face-up card and the deck back. */
const cardSize = ( large?: boolean ) => large
	? "h-full w-auto aspect-[2/3]"
	: "w-16 md:w-20 h-24 md:h-30";

export function GameCard( { card, disabled, onCardClick, large }: GameCardProps ) {
	return (
		<div
			className={ cn(
				"flex flex-col rounded-md overflow-hidden justify-between",
				cardSize( large ),
				"text-neutral-dark transition",
				"bg-background border-3 border-inverted-surface shadow-sm md:shadow-md",
				large && "border-4 rounded-xl",
				!disabled && "cursor-pointer hover:shadow-none",
				!disabled && "hover:translate-x-boxShadowX hover:translate-y-boxShadowY"
			) }
			onClick={ () => !disabled && onCardClick && onCardClick() }
		>
			<div className={ "flex justify-between" }>
				<div
					className={ cn(
						"rounded-br-full rounded-tl-md bg-accent w-5 md:w-6 -px-1 h-5 md:h-6",
						"flex items-center justify-center text-neutral-dark",
						large && "w-11 md:w-11 h-11 md:h-11"
					) }
				>
					<div
						className={ cn(
							"text-sm leading-none -ml-1.5 mb-1",
							large && "text-2xl -ml-2 mb-2"
						) }
					>
						{ card.points ?? 0 }
					</div>
				</div>
				<img
					src={ `/splendor/tokens/${ card.bonus }.svg` }
					className={ cn( "w-7 md:w-8", large && "w-14 md:w-14" ) }
				/>
			</div>
			<div className={ cn( "flex flex-wrap-reverse gap-1 p-1", large && "gap-2 p-2" ) }>
				{ Object.keys( card.cost )
					.map( g => g as keyof Cost )
					.filter( gem => card.cost[ gem ] > 0 )
					.map( gem => (
						<div
							key={ gem }
							className={ cn(
								"flex rounded-full justify-center items-center w-5 h-5",
								"border border-inverted-surface",
								large && "w-9 h-9 border-2",
								gemColors[ gem ]
							) }
						>
							<span className={ cn( "text-xs", large && "text-lg" ) }>
								{ card.cost[ gem ] }
							</span>
						</div>
					) ) }
			</div>
		</div>
	);
}

export function GameCardBack( props: { level: CardLevel; large?: boolean } ) {
	return (
		<div
			className={ cn(
				cardSize( props.large ),
				"rounded-lg",
				"flex justify-center items-center",
				"bg-gray-400 border-3 border-inverted-surface",
				"flex items-center justify-center p-1",
				levelColors[ props.level ],
				"text-xl font-bold",
				props.large && "border-4 rounded-xl text-6xl"
			) }
		>
			{ levelText[ props.level ] }
		</div>
	);
}
