import { cn } from "cn";
import { AnimatePresence, motion } from "framer-motion";

import type { CallbreakConfig, CallbreakView } from "@/games/callbreak/schema";
import { getPlayableCards } from "@/games/callbreak/utils";
import { SPRING } from "@/shared/shell/animation";
import { RCard } from "@/shared/shell/card";
import type { CardId } from "@/shared/utils/cards";
import { getSortedHand } from "@/shared/utils/cards";
import type { GameView } from "@/swish/schema";

type Game = GameView<CallbreakView, CallbreakConfig>;

export type HandViewProps = {
	readonly game: Game;
	readonly isMyTurn: boolean;
	readonly selectedCard?: CardId;
	readonly onSelectCard: ( cardId: CardId ) => void;
};

export function HandView( { game, isMyTurn, selectedCard, onSelectCard }: HandViewProps ) {
	const hand = [ ...game.view.hand ];
	const trick = game.view.activeDeal?.tricks[ 0 ];
	const isTrickComplete = !!trick?.winner;
	const isTrickActive = !!trick && !isTrickComplete;

	const playable = isTrickActive
		? getPlayableCards( hand, game.config.trumpSuit, trick )
		: [];

	const isSelectable = ( cardId: CardId ) =>
		isMyTurn && isTrickActive && playable.includes( cardId );

	return (
		<motion.div
			layout
			className={ cn(
				"rounded-md p-2 md:p-3 flex gap-2 md:gap-3 flex-wrap justify-center bg-background",
				isTrickActive && isMyTurn && "border-accent border-4"
			) }
		>
			<AnimatePresence mode={ "popLayout" }>
				{ getSortedHand( hand ).map( cardId => (
					<motion.div
						key={ cardId }
						layoutId={ `card-${ cardId }` }
						layout
						initial={ { scale: 0.6, opacity: 0 } }
						animate={ { scale: cardId === selectedCard ? 1.08 : 1, opacity: 1 } }
						exit={ { scale: 0.6, opacity: 0, transition: { duration: 0.2 } } }
						transition={ SPRING }
						whileHover={ isSelectable( cardId ) ? { scale: 1.05 } : undefined }
						className={ cn(
							"relative p-1 rounded-md",
							isSelectable( cardId ) ? "cursor-pointer" : "cursor-default",
							cardId === selectedCard && "bg-accent/20 border border-accent"
						) }
						onClick={ () => isSelectable( cardId ) && onSelectCard( cardId ) }
					>
						{ isTrickActive && isMyTurn && !playable.includes( cardId ) && (
							<div
								className={ cn(
									"absolute inset-1 rounded-lg z-10",
									"cursor-not-allowed bg-neutral-500/50"
								) }
							/>
						) }
						<RCard cardId={ cardId }/>
					</motion.div>
				) ) }
			</AnimatePresence>
			{ hand.length === 0 && <h2>NO CARDS LEFT</h2> }
		</motion.div>
	);
}
