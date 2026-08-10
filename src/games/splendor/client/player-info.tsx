"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import type { Gem } from "@/games/splendor/shared/schema.ts";
import { GEMS_WITH_GOLD } from "@/games/splendor/shared/utils.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";
import { CounterTween } from "@/shared/ui/components/counter-tween.tsx";
import { FloatPlusN } from "@/shared/ui/components/float-plus-n.tsx";
import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { useSplendorBoard } from "@/games/splendor/client/context.tsx";
import { gemColors, gemLightColors } from "@/games/splendor/client/utils.tsx";

function PlayerTokenCount( props: { gem: Gem; playerId: PlayerId; large?: boolean } ) {
	const { data } = useSplendorBoard();
	const count = data.view.playerData[ props.playerId ].tokens[ props.gem ];

	return (
		<motion.div
			animate={ { scale: [ 1, 1.15, 1 ] } }
			transition={ { duration: 0.4 } }
			key={ count }
			className={ cn(
				"w-6 h-6 flex justify-center items-center rounded-full",
				"border border-dotted border-inverted-surface",
				"text-sm text-center text-neutral-dark",
				props.large && "w-10 h-10 text-xl border-2",
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
	const { data } = useSplendorBoard();
	const reserved = data.view.playerData[ props.playerId ]?.reserved ?? [];

	return (
		<div
			className={ cn(
				"w-8 h-12 p-1",
				"flex rounded-md items-center justify-center",
				"border-2 border-inverted-surface",
				"text-2xl text-neutral-dark",
				props.large && "w-12 h-16 text-3xl rounded-lg",
				gemLightColors[ "gold" ]
			) }
		>
			<h2>{ reserved.length }</h2>
		</div>
	);
}

function PurchasedCards(
	props: { gem: Exclude<Gem, "gold">; playerId: PlayerId; large?: boolean }
) {
	const { data } = useSplendorBoard();
	const cards = data.view.playerData[ props.playerId ].cards;
	const count = cards.filter( c => c.bonus === props.gem ).length;
	return (
		<motion.div
			animate={ { scale: [ 1, 1.2, 1 ] } }
			transition={ { duration: 0.45 } }
			key={ count }
			className={ cn(
				"w-8 h-12 p-1",
				"flex rounded-md items-center justify-center",
				"border-2 border-inverted-surface",
				"text-2xl text-neutral-dark",
				props.large && "w-12 h-16 text-3xl rounded-lg",
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
		<div className={ cn( "flex justify-around gap-2 flex-1 p-2", props.large && "gap-3 p-3" ) }>
			{ GEMS_WITH_GOLD.map( gem => (
				<div
					key={ gem }
					className={ cn(
						"flex flex-col gap-1 items-center justify-center",
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
	const { data } = useSplendorBoard();
	const baseInfo = data.players[ playerId ];
	const gameInfo = data.view.playerData[ playerId ];
	const isCurrentTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === playerId;

	return (
		<motion.div
			layout
			className={ cn(
				"bg-background rounded-md overflow-hidden relative",
				bg && "bg-accent/20",
				large && "rounded-xl"
			) }
			animate={ isCurrentTurn
				? {
					boxShadow: [
						"0 0 0 0 rgba(0,0,0,0)",
						"0 0 0 4px var(--color-accent)",
						"0 0 0 0 rgba(0,0,0,0)"
					]
				}
				: { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
			}
			transition={ isCurrentTurn
				? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
				: { duration: 0.3 }
			}
		>
			<div className={ "flex gap-2 justify-between" }>
				<div
					className={ cn(
						"flex sm:flex-col gap-2 items-center p-2 min-w-30",
						large && "p-3 min-w-40 gap-1"
					) }
				>
					<Avatar
						className={ cn(
							"rounded-full w-8 h-8 md:w-10 md:h-10 xl:h-12 xl:w-12",
							large && "w-16 h-16 md:w-16 md:h-16 xl:w-16 xl:h-16"
						) }
					>
						<AvatarImage src={ baseInfo.avatar } alt={ "" } className={ "bg-accent" }/>
					</Avatar>
					<div
						className={ cn(
							"flex flex-col text-center text-sm md:text-lg",
							large && "md:text-2xl font-heading"
						) }
					>
						{ baseInfo.name?.split( " " )[ 0 ] }
					</div>
				</div>
				<div className={ "hidden sm:flex flex-1" }>
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
						large && "w-28 md:w-32"
					) }
				>
					<div
						className={ cn(
							"text-4xl font-heading text-neutral-dark text-center",
							large && "text-6xl"
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
