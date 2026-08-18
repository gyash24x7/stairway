"use client";

import { motion } from "framer-motion";

import type { ReactNode } from "react";

import { useSplendor } from "@/games/splendor/client/context.tsx";
import { gemColors, gemLightColors } from "@/games/splendor/client/utils.tsx";
import { ALL_GEMS } from "@/games/splendor/shared/utils.ts";
import { CounterTween } from "@/shared/ui/components/counter-tween.tsx";
import { FloatPlusN } from "@/shared/ui/components/float-plus-n.tsx";
import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { Gem } from "@/games/splendor/shared/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

function PlayerTokenCount( props: { gem: Gem; playerId: PlayerId; large?: boolean } ) {
	const { data } = useSplendor();
	const count = data.view.playerData[ props.playerId ].tokens[ props.gem ];

	return (
		<motion.div
			animate={ { scale: [ 1, 1.15, 1 ] } }
			transition={ { duration: 0.4 } }
			key={ count }
			className={ cn(
				"w-6 h-6 shrink-0 flex justify-center items-center rounded-full",
				"border border-dotted border-outline",
				"text-sm text-center text-neutral-dark",
				props.large && "w-8 h-8 text-lg border-2",
				gemColors[ props.gem ]
			) }
		>
			{ count }
		</motion.div>
	);
}

/**
 * How many cards a seat is holding in reserve — the count only.
 *
 * This is what the couch screen shows. Reserved cards are a seat's private
 * business, so a television must never render their faces, even though the table
 * projection currently carries them.
 */
function ReservedCount( props: { playerId: PlayerId; large?: boolean } ) {
	const { data } = useSplendor();
	const reserved = data.view.playerData[ props.playerId ]?.reserved ?? [];

	return (
		<div
			className={ cn(
				"w-8 h-12 p-1 shrink-0",
				"flex rounded-md items-center justify-center",
				"border-2 border-outline",
				"text-2xl text-neutral-dark",
				props.large && "w-10 h-14 text-2xl rounded-lg",
				gemLightColors[ "gold" ]
			) }
		>
			<h2>{ reserved.length }</h2>
		</div>
	);
}

export function PurchasedCards(
	props: { gem: Exclude<Gem, "gold">; playerId: PlayerId; large?: boolean }
) {
	const { data } = useSplendor();
	const cards = data.view.playerData[ props.playerId ].cards;
	const count = cards.filter( c => c.bonus === props.gem ).length;
	return (
		<motion.div
			animate={ { scale: [ 1, 1.2, 1 ] } }
			transition={ { duration: 0.45 } }
			key={ count }
			className={ cn(
				"w-8 h-12 p-1 shrink-0",
				"flex rounded-md items-center justify-center",
				"border-2 border-outline",
				"text-2xl text-neutral-dark",
				props.large && "w-10 h-14 text-2xl rounded-lg",
				gemLightColors[ props.gem ]
			) }
		>
			<h2>{ count }</h2>
		</motion.div>
	);
}

function PlayerGemInfo(
	props: { playerId: PlayerId; reservedSlot?: ReactNode; large?: boolean }
) {
	return (
		<div
			className={ cn(
				"flex justify-around gap-2 flex-1 p-2 min-w-0 overflow-hidden",
				props.large && "gap-2 p-2"
			) }
		>
			{ ALL_GEMS.map( gem => (
				<div
					key={ gem }
					className={ cn(
						"flex flex-col gap-1 items-center justify-center shrink-0",
						props.large && "gap-2"
					) }
				>
					{ gem !== "gold" && (
						<PurchasedCards playerId={ props.playerId } gem={ gem } large={ props.large }/>
					) }
					{ gem === "gold" && ( props.reservedSlot ?? (
						<ReservedCount playerId={ props.playerId } large={ props.large }/>
					) ) }
					<PlayerTokenCount gem={ gem } playerId={ props.playerId } large={ props.large }/>
				</div>
			) ) }
		</div>
	);
}

export type PlayerInfoProps = {
	playerId: PlayerId;
	bg?: boolean;
	/**
	 * Replaces the plain reserved-count tile with an interactive drawer. The phone
	 * passes `ReservedCardsDrawer`; the couch passes nothing and stays read-only.
	 */
	reservedSlot?: ReactNode;
	/** Television sizing — readable from across a room. Used by the couch rail. */
	large?: boolean;
};

export function PlayerInfo( { playerId, bg, reservedSlot, large }: PlayerInfoProps ) {
	const { data } = useSplendor();
	const baseInfo = data.players[ playerId ];
	const gameInfo = data.view.playerData[ playerId ];
	const isCurrentTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === playerId;

	return (
		<motion.div
			layout
			className={ cn(
				"bg-background rounded-md relative transition-shadow",
				bg && "bg-accent/20",
				large && "rounded-xl",
				// A steady ring, not a pulsing one: the seat on turn has to be findable
				// in a column of four, but a loop running the whole turn is a distraction.
				isCurrentTurn && "ring-4 ring-accent"
			) }
		>
			<div className={ "flex gap-2 justify-between" }>
				<div
					className={ cn(
						"flex sm:flex-col gap-2 items-center p-2 min-w-30 shrink-0",
						large && "p-3 min-w-32 gap-1"
					) }
				>
					<Avatar
						className={ cn(
							"rounded-full w-8 h-8 md:w-10 md:h-10 xl:h-12 xl:w-12",
							large && "w-14 h-14 md:w-14 md:h-14 xl:w-14 xl:h-14"
						) }
					>
						<AvatarImage src={ baseInfo.avatar } alt={ "" } className={ "bg-accent" }/>
					</Avatar>
					<div
						className={ cn(
							"flex flex-col text-center text-sm md:text-lg truncate max-w-full",
							large && "md:text-xl font-heading"
						) }
					>
						{ baseInfo.name?.split( " " )[ 0 ] }
					</div>
				</div>
				{ /*
					  * `min-w-0` is what keeps the score on screen. A flex item defaults to
					  * `min-width: auto`, so this strip refused to go below the width of six
					  * gem columns — 372px at couch size — and the row overran the rail,
					  * whose `overflow-hidden` then clipped whatever sat last. That is the
					  * points block. The gems give way instead: they are counts a viewer can
					  * lose the end of, and the score is the one thing they cannot.
					  */ }
				<div className={ "hidden sm:flex flex-1 min-w-0" }>
					<PlayerGemInfo
						playerId={ playerId }
						reservedSlot={ reservedSlot }
						large={ large }
					/>
				</div>
				<div
					className={ cn(
						"flex items-center justify-center bg-accent relative",
						"rounded-r-md w-16 md:w-20 shrink-0",
						large && "w-24 md:w-28"
					) }
				>
					<div
						className={ cn(
							"text-4xl font-heading text-neutral-dark text-center",
							large && "text-5xl"
						) }
					>
						<CounterTween value={ gameInfo.points }/>
					</div>
					<FloatPlusN
						value={ gameInfo.points }
						className={ cn( "text-base md:text-lg", large && "text-2xl" ) }
					/>
				</div>
			</div>
			<div className={ "block sm:hidden" }>
				<PlayerGemInfo playerId={ playerId } reservedSlot={ reservedSlot } large={ large }/>
			</div>
		</motion.div>
	);
}
