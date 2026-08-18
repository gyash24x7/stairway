"use client";

import { motion } from "framer-motion";

import { cn } from "@/shared/ui/utils/cn.ts";

/**
 * Hoisted out of render so the pulse keeps its own timeline. Framer restarts a
 * keyframe animation when the target is a fresh array, and this component
 * re-renders on every state push — which is what had four dotted slots flashing
 * out of step and out of nowhere.
 */
const PULSE = { opacity: [ 0.4, 1, 0.4 ] };
const PULSE_TRANSITION = { duration: 1.6, repeat: Infinity, ease: "easeInOut" } as const;

export type DeclarationBadgeProps = {
	wins?: number;
	pending?: boolean;
	large?: boolean;
};

export function DeclarationBadge( { wins, pending, large }: DeclarationBadgeProps ) {
	const slot = cn(
		"w-16 md:w-20 xl:w-24 h-24 md:h-30 xl:h-36",
		"rounded-lg flex flex-col gap-1 items-center justify-center shrink-0",
		large && "w-28 md:w-36 xl:w-44 h-42 md:h-54 xl:h-66 gap-2 rounded-xl"
	);

	if ( wins === undefined ) {
		return (
			<motion.div
				className={ cn( slot, "border-2 border-dotted border-outline bg-surface" ) }
				initial={ false }
				animate={ pending ? PULSE : { opacity: 0.45 } }
				transition={ pending ? PULSE_TRANSITION : { duration: 0.2 } }
			>
				<span
					className={ cn(
						"font-heading text-2xl md:text-3xl text-foreground/60",
						large && "text-5xl md:text-6xl"
					) }
				>
					{ pending ? "?" : "" }
				</span>
			</motion.div>
		);
	}

	return (
		<motion.div
			className={ cn( slot, "bg-accent text-neutral-dark border-2 border-outline" ) }
			initial={ { scale: 0, opacity: 0 } }
			animate={ { scale: 1, opacity: 1 } }
			exit={ { scale: 0.6, opacity: 0, transition: { duration: 0.25 } } }
			transition={ { type: "spring", stiffness: 420, damping: 18 } }
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
