"use client";

import { AnimatePresence, motion } from "framer-motion";

import { RCard } from "@/shared/ui/components/card.tsx";
import { RPlayerInfoStrip } from "@/shared/ui/components/player-info.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { useCallbreakBoard } from "@/games/callbreak/client/context.tsx";

/**
 * The controller's compact board context: what has been played into the trick so
 * far. Just enough to choose a card without looking up at the television — the
 * full table is `DealView`, and it stays on the TV. Trump and lead live in their
 * own `SuitBar` above.
 *
 * Cards carry the same `card-${id}` `layoutId` the hand uses, so playing one
 * flies it out of your hand and into the trick rather than popping it in.
 */
export function TrickStrip() {
	const { data } = useCallbreakBoard();
	const trick = data.view.activeDeal?.tricks[ 0 ];

	if ( !trick ) {
		return null;
	}

	const played = data.context.players.flatMap( playerId => {
		const cardId = trick.cards[ playerId ];
		return cardId ? [ { playerId, cardId } ] : [];
	} );

	return (
		<motion.div
			layout
			className={ cn(
				"flex flex-col gap-2 bg-background rounded-md p-3 w-full min-h-36",
				"justify-center"
			) }
		>
			<AnimatePresence mode={ "popLayout" } initial={ false }>
				{ played.length > 0 ? (
					<motion.div
						key={ "played" }
						layout
						className={ "flex gap-3 flex-wrap justify-center" }
					>
						{ played.map( ( { playerId, cardId } ) => (
							<motion.div
								key={ cardId }
								layout
								layoutId={ `card-${ cardId }` }
								initial={ { scale: 0.6, opacity: 0 } }
								animate={ { scale: 1, opacity: 1 } }
								exit={ { scale: 0.6, opacity: 0, transition: { duration: 0.25 } } }
								transition={ { type: "spring", stiffness: 380, damping: 22 } }
								className={ "flex flex-col gap-1 items-center" }
							>
								<RCard cardId={ cardId } small/>
								<RPlayerInfoStrip player={ data.players[ playerId ] } noAvatar/>
							</motion.div>
						) ) }
					</motion.div>
				) : (
					<motion.p
						key={ "empty" }
						initial={ { opacity: 0 } }
						animate={ { opacity: 1 } }
						exit={ { opacity: 0 } }
						className={ "text-sm text-center text-muted-foreground" }
					>
						NO CARDS PLAYED YET
					</motion.p>
				) }
			</AnimatePresence>
		</motion.div>
	);
}
