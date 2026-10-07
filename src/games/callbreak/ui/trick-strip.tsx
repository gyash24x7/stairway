import { cn } from "cn";
import { AnimatePresence, motion } from "framer-motion";

import type { CallbreakConfig, CallbreakView } from "@/games/callbreak/schema";
import { displayedTrick, trickPlayOrder } from "@/games/callbreak/utils";
import { SPRING } from "@/shared/shell/animation";
import { RCard } from "@/shared/shell/card";
import type { GameView } from "@/swish/schema";
import { RPlayerInfoStrip } from "@/swish/ui/player-info";

type Game = GameView<CallbreakView, CallbreakConfig>;

/**
 * The controller's compact board context: what has been played into the trick so
 * far. Just enough to choose a card without looking up at the television — the
 * full table is `DealView`, and it stays on the TV. Trump and lead live in their
 * own `SuitBar` above.
 *
 * Cards carry the same `card-${id}` `layoutId` the hand uses, so playing one
 * flies it out of your hand and into the trick rather than popping it in.
 *
 * A completed trick stays up until the next one is led — see `displayedTrick` —
 * so the card that finished it is seen, and so is who took it.
 */
export function TrickStrip( { game }: { game: Game } ) {
	const trick = displayedTrick( game.view );

	if ( !trick ) {
		return null;
	}

	// In the order they were played, starting from whoever led — the seating
	// order is only the play order for the trick the first seat happens to lead.
	const played = trickPlayOrder( trick, game.context.players ).flatMap( playerId => {
		const cardId = trick.cards[ playerId ];
		const player = game.players[ playerId ];
		return cardId && player ? [ { player, cardId, won: trick.winner === playerId } ] : [];
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
						{ played.map( ( { player, cardId, won } ) => (
							<motion.div
								key={ cardId }
								layout
								layoutId={ `card-${ cardId }` }
								initial={ { scale: 0.6, opacity: 0 } }
								animate={ { scale: 1, opacity: 1 } }
								exit={ { scale: 0.6, opacity: 0, transition: { duration: 0.25 } } }
								transition={ SPRING }
								className={ cn(
									"flex flex-col gap-1 items-center rounded-md",
									won && "outline-4 outline-green-500 outline-offset-2"
								) }
							>
								<RCard cardId={ cardId } small/>
								<RPlayerInfoStrip player={ player } noAvatar/>
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
