"use client";

import { motion } from "framer-motion";

import { cn } from "@/shared/ui/utils/cn.ts";

export type DeclarationBadgeProps = {
	/** How many tricks this seat declared, or `undefined` while they're still deciding. */
	wins?: number;
	/** Television sizing — matches the large card slot on the couch screen. */
	large?: boolean;
};

/**
 * A seat's declaration during the `DECLARING` phase, shown in the same slot the
 * played card will occupy once the deal starts — so the seat's geometry doesn't
 * change when the phase flips.
 *
 * The number lands with an overshoot rather than fading in: a declaration is the
 * one event of this phase, and on a television across a room a fade reads as
 * nothing happening at all.
 */
export function DeclarationBadge( { wins, large }: DeclarationBadgeProps ) {
	const slot = cn(
		"w-16 md:w-20 xl:w-24 h-24 md:h-30 xl:h-36",
		"rounded-lg flex flex-col gap-1 items-center justify-center shrink-0",
		large && "w-28 md:w-36 xl:w-44 h-42 md:h-54 xl:h-66 gap-2 rounded-xl"
	);

	if ( wins === undefined ) {
		return (
			<motion.div
				className={ cn( slot, "border-2 border-dotted border-inverted-surface bg-surface" ) }
				initial={ { opacity: 0 } }
				animate={ { opacity: [ 0.35, 0.75, 0.35 ] } }
				exit={ { opacity: 0 } }
				transition={ { duration: 1.6, repeat: Infinity, ease: "easeInOut" } }
			>
				<span
					className={ cn(
						"font-heading text-2xl md:text-3xl text-foreground/60",
						large && "text-5xl md:text-6xl"
					) }
				>
					?
				</span>
			</motion.div>
		);
	}

	return (
		<motion.div
			className={ cn( slot, "bg-accent text-neutral-dark border-2 border-inverted-surface" ) }
			initial={ { scale: 0, opacity: 0 } }
			animate={ { scale: [ 0, 1.25, 1 ], opacity: [ 0, 1, 1 ] } }
			exit={ { scale: 0.6, opacity: 0, transition: { duration: 0.25 } } }
			transition={ { duration: 0.65, times: [ 0, 0.55, 1 ], ease: "easeOut" } }
		>
			<span
				className={ cn(
					"text-[8px] md:text-xs tracking-widest",
					large && "text-lg md:text-xl"
				) }
			>
				DECLARED
			</span>
			<span
				className={ cn(
					"font-heading text-4xl md:text-5xl leading-none",
					large && "text-8xl md:text-9xl"
				) }
			>
				{ wins }
			</span>
		</motion.div>
	);
}
