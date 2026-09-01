import { cn } from "@/shared/ui/utils/cn.ts";

import type { CharacterCard } from "@/games/coup/shared/schema.ts";

/**
 * What each character does, in the fewest words that still tell you why you
 * would play it. The card is the rules reference — a player holding two of these
 * should not have to look anything up.
 */
const BLURB: Record<CharacterCard, string> = {
	duke: "Tax +3 · blocks foreign aid",
	assassin: "Assassinate for 3",
	captain: "Steal 2 · blocks stealing",
	ambassador: "Exchange · blocks stealing",
	contessa: "Blocks assassination"
};

const LABEL: Record<CharacterCard, string> = {
	duke: "DUKE",
	assassin: "ASSASSIN",
	captain: "CAPTAIN",
	ambassador: "AMBASSADOR",
	contessa: "CONTESSA"
};

type CharacterCardProps = {
	card: CharacterCard;
	/** Picked out as the one being acted on. */
	selected?: boolean;
	large?: boolean;
	onClick?: () => void;
	disabled?: boolean;
};

/**
 * One character, face up.
 *
 * Only ever a card the viewer is entitled to see — their own hand, or the
 * choices a window is offering them. A card somebody else is holding is not a
 * card this component is given; it is a count the seat renders as
 * {@link HiddenCard} instead, and the view carries no characters to leak.
 */
export function RCharacterCard( props: CharacterCardProps ) {
	const interactive = props.onClick !== undefined && !props.disabled;

	return (
		<button
			type={ "button" }
			disabled={ !interactive }
			onClick={ props.onClick }
			className={ cn(
				"flex flex-col justify-between text-left",
				"rounded-base border-2 border-outline bg-surface",
				props.large ? "w-36 h-48 p-4" : "w-28 h-40 p-3",
				props.selected && "ring-4 ring-accent",
				interactive && "transition-all hover:translate-x-boxShadowX",
				interactive && "hover:translate-y-boxShadowY hover:shadow-none",
				interactive && "shadow-sm md:shadow-md",
				!interactive && "cursor-default"
			) }
		>
			<span
				className={ cn(
					"font-heading tracking-wide text-accent",
					props.large ? "text-2xl" : "text-base"
				) }
			>
				{ LABEL[ props.card ] }
			</span>

			<span
				className={ cn(
					"text-muted-foreground leading-tight",
					props.large ? "text-sm" : "text-xs"
				) }
			>
				{ BLURB[ props.card ] }
			</span>
		</button>
	);
}

/**
 * A card somebody else is holding: the back of it, and nothing more.
 *
 * There is no `card` prop to pass a character to, which is the point — an
 * opponent's characters never reach this client, so a back cannot be rendered
 * with one by mistake.
 */
export function HiddenCard( props: { large?: boolean } ) {
	return (
		<div
			className={ cn(
				"rounded-base border-2 border-outline bg-inverted-surface",
				"flex items-center justify-center",
				props.large ? "w-36 h-50" : "w-28 h-40"
			) }
		>
			<span
				className={ cn(
					"font-title text-surface/50",
					props.large ? "text-5xl" : "text-3xl"
				) }
			>
				?
			</span>
		</div>
	);
}
