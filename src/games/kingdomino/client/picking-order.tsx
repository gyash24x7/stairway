"use client";

import { motion } from "framer-motion";
import { ChevronRightIcon } from "lucide-react";
import { Fragment } from "react";

import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { useKingdominoBoard } from "@/games/kingdomino/client/context.tsx";

export type PickingOrderProps = {
	/** Television sizing — readable from across a room. Used by the couch rail. */
	large?: boolean;
	className?: string;
};

/**
 * Who picks from the draft, and in what order.
 *
 * `selectionOrder` holds one slot per pick rather than one per seat — a two-player
 * round gives each seat two of the four slots — so this renders the raw sequence
 * and a seat legitimately appears more than once. The seat currently on the clock
 * is the slot at `consumed`, exactly how the engine's `resolveNextPlayer` resolves
 * it, so the highlight can't drift from whose turn it actually is.
 *
 * Reads the *board* context, so the same component serves the game page, the
 * controller and the television — the order is public in Kingdomino.
 */
export function PickingOrder( { large, className }: PickingOrderProps ) {
	const { data } = useKingdominoBoard();

	const order = data.view.selectionOrder;
	if ( order.length === 0 ) {
		return null;
	}

	// The engine advances the picker by counting claimed draft entries. Once the
	// round's picks are all in, this runs past the end and nothing is highlighted —
	// which is correct: during PLACE nobody is picking.
	const consumed = data.view.draft.filter( entry => !!entry.selectedBy ).length;

	return (
		<div
			className={ cn(
				"flex items-center gap-3 bg-background rounded-md p-2 overflow-hidden",
				large && "gap-5 p-5 rounded-xl",
				className
			) }
		>
			<p
				className={ cn(
					"text-xs tracking-widest text-foreground/70 shrink-0",
					large && "text-2xl"
				) }
			>
				PICKING<br/>ORDER
			</p>
			<div
				className={ cn(
					"flex items-center gap-1 flex-1 min-w-0 justify-around",
					large && "gap-2"
				) }
			>
				{ order.map( ( playerId, index ) => {
					const player = data.players[ playerId ];
					const isDone = index < consumed;
					const isCurrent = index === consumed;

					return (
						<Fragment key={ `${ playerId }-${ index }` }>
							{ index > 0 && (
								<ChevronRightIcon
									className={ cn(
										"w-3 h-3 shrink-0 text-foreground/40",
										large && "w-7 h-7"
									) }
								/>
							) }
							<div className={ cn( "flex flex-col items-center gap-1 shrink-0" ) }>
								<motion.div
									animate={ isCurrent
										? {
											boxShadow: [
												"0 0 0 0 rgba(0,0,0,0)",
												"0 0 0 4px var(--color-accent)",
												"0 0 0 0 rgba(0,0,0,0)"
											]
										}
										: { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
									}
									transition={ isCurrent
										? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
										: { duration: 0.3 }
									}
									className={ "rounded-full" }
								>
									<Avatar
										className={ cn(
											"rounded-full w-8 h-8 border-2 border-transparent",
											isDone && "opacity-40",
											isCurrent && "border-accent",
											large && "w-16 h-16 border-4"
										) }
									>
										<AvatarImage src={ player?.avatar } alt={ "" } className={ "bg-accent" }/>
									</Avatar>
								</motion.div>
								{ large && (
									<span
										className={ cn(
											"text-lg font-heading truncate max-w-24",
											isDone && "opacity-40"
										) }
									>
										{ player?.name?.split( " " )[ 0 ] }
									</span>
								) }
							</div>
						</Fragment>
					);
				} ) }
			</div>
		</div>
	);
}
