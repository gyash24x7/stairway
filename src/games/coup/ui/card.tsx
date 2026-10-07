import { cn } from "cn";

import type { CoupCard } from "@/games/coup/schema";


/**
 * What each character does, in the fewest words that still decide a turn.
 *
 * On the card itself rather than in a rules drawer, because Coup is played by
 * claiming characters you may not hold, and a player who has to leave the table
 * to remember what an Ambassador does is a player who will not bluff one.
 */
export const CARD_TEXT: Record<CoupCard, { action: string; block: string }> = {
	DUKE: { action: "Tax — take 3", block: "Blocks Foreign Aid" },
	ASSASSIN: { action: "Assassinate — pay 3", block: "—" },
	CAPTAIN: { action: "Steal — take 2", block: "Blocks Steal" },
	AMBASSADOR: { action: "Exchange with deck", block: "Blocks Steal" },
	CONTESSA: { action: "—", block: "Blocks Assassination" }
};

/**
 * A tint per character, so a hand is read by colour before it is read by name.
 *
 * Each is a border and a wash rather than a fill: a filled card competes with the
 * accent, which throughout the app means "you", and every one of these is
 * somebody's card rather than a thing to act on.
 */
const CARD_TINT: Record<CoupCard, string> = {
	DUKE: "border-purple-500 bg-purple-500/10",
	ASSASSIN: "border-zinc-500 bg-zinc-500/10",
	CAPTAIN: "border-sky-500 bg-sky-500/10",
	AMBASSADOR: "border-emerald-500 bg-emerald-500/10",
	CONTESSA: "border-rose-500 bg-rose-500/10"
};

export type CoupCardTileProps = {
	readonly card: CoupCard;
	/** Face up but out of play — an influence already lost. Drawn struck through. */
	readonly spent?: boolean;
	/** Compact sizing, for a seat's row rather than a player's own hand. */
	readonly small?: boolean;
	readonly selected?: boolean;
	readonly onClick?: () => void;
	readonly disabled?: boolean;
	readonly className?: string;
};

/** One character card, face up. */
export function CoupCardTile( props: CoupCardTileProps ) {
	const { card, spent, small, selected, onClick, disabled, className } = props;
	const text = CARD_TEXT[ card ];
	const interactive = !!onClick && !disabled;

	return (
		<button
			type={ "button" }
			onClick={ interactive ? onClick : undefined }
			disabled={ !interactive }
			aria-pressed={ onClick ? !!selected : undefined }
			className={ cn(
				"flex shrink-0 flex-col items-center justify-center rounded-base border-2",
				"text-center font-heading transition",
				CARD_TINT[ card ],
				small ? "w-20 gap-0 px-1 py-1 text-[10px]" : "w-28 gap-1 px-2 py-3 text-xs md:w-32",
				spent && "opacity-50 grayscale",
				selected && "ring-2 ring-accent ring-offset-1 ring-offset-background",
				interactive && "cursor-pointer hover:brightness-110",
				!interactive && !!onClick && "cursor-not-allowed opacity-60",
				!onClick && "cursor-default",
				className
			) }
		>
			<span className={ cn( small ? "text-xs" : "text-sm md:text-base", spent && "line-through" ) }>
				{ card }
			</span>
			{ !small && (
				<>
					<span className={ "text-muted-foreground" }>{ text.action }</span>
					<span className={ "text-muted-foreground" }>{ text.block }</span>
				</>
			) }
		</button>
	);
}

export type CardBackProps = {
	readonly small?: boolean;
	/**
	 * An influence this seat has already given up. The card went back into the
	 * deck and was never shown, so this marks the loss without naming the card.
	 */
	readonly lost?: boolean;
	readonly className?: string;
};

/**
 * A card nobody at the table can see.
 *
 * Rendered as a real tile the same size as a face-up one rather than as a pip or
 * a counter, because how many influences somebody has left is the single most
 * important number on the table and it should be countable at a glance.
 */
export function CoupCardBack( { small, lost, className }: CardBackProps ) {
	return (
		<div
			aria-label={ lost ? "Influence lost" : "Hidden influence" }
			className={ cn(
				"flex shrink-0 items-center justify-center rounded-base",
				"font-heading text-muted-foreground",
				lost
					? "border-2 border-dashed border-outline bg-transparent opacity-60"
					: "border-2 border-outline bg-foreground/10",
				small ? "w-20 py-1 text-xs" : "w-28 py-6 text-lg md:w-32",
				className
			) }
		>
			{ lost ? "✕" : "?" }
		</div>
	);
}
