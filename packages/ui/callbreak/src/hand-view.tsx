"use client";

import { getPlayableCards } from "@s2h/callbreak/utils";
import { RCard } from "@s2h/ui/components/card";
import { cn } from "@s2h/ui/utils/cn";
import { type CardId, getSortedHand } from "@s2h/utils/cards";
import { AnimatePresence, motion } from "framer-motion";
import { useCallbreak } from "./context";

export function HandView() {
	const { shared, player, isMyTurn, selectCard, selectedCard } = useCallbreak();
	const deal = shared.state.activeDeal;
	const trick = deal?.tricks[ 0 ];

	const isTrickComplete = !!trick?.winner;

	const isSelectionAllowed = ( cardId: CardId ) => {
		if ( !trick ) {
			return false;
		}

		if ( isTrickComplete ) {
			return true;
		}
		const playableCards = getPlayableCards( [ ...player.hand ], shared.config.trumpSuit, trick! );
		return playableCards.includes( cardId );
	};

	const isTrickActive = trick && !isTrickComplete;

	const handleCardClick = ( cardId: CardId ) => () => {
		if ( !trick ) {
			return;
		}

		if ( isSelectionAllowed( cardId ) && isMyTurn ) {
			selectCard( cardId );
		}
	};

	return (
		<motion.div
			layout
			className={ cn(
				"rounded-md p-2 md:p-3 flex gap-2 md:gap-3 flex-wrap justify-center bg-background",
				isTrickActive && isMyTurn && "border-accent border-4"
			) }
		>
			<AnimatePresence mode={ "popLayout" }>
				{ getSortedHand( [ ...player.hand ] ).map( ( cardId ) => (
					<motion.div
						key={ cardId }
						layoutId={ `card-${ cardId }` }
						layout
						initial={ { scale: 0.6, opacity: 0 } }
						animate={ {
							scale: cardId === selectedCard ? 1.08 : 1,
							opacity: 1
						} }
						exit={ { scale: 0.6, opacity: 0, transition: { duration: 0.2 } } }
						transition={ { type: "spring", stiffness: 380, damping: 22 } }
						whileHover={ isSelectionAllowed( cardId ) && isMyTurn ? { scale: 1.05 } : undefined }
						className={ cn(
							"cursor-pointer p-1 z-10 rounded-md",
							cardId === selectedCard && "bg-accent/20 border border-accent"
						) }
						onClick={ handleCardClick( cardId ) }
					>
						<div
							className={ cn(
								"absolute w-16 md:w-20 xl:w-24 p-1 md:p-1.5 h-24 md:h-30 xl:h-36 rounded-md",
								( isTrickActive && !isSelectionAllowed( cardId ) && isMyTurn ) &&
								"cursor-not-allowed bg-gray-500 opacity-50"
							) }
						/>
						<RCard cardId={ cardId }/>
					</motion.div>
				) ) }
			</AnimatePresence>
			{ player.hand.length === 0 && <h2>NO CARDS LEFT</h2> }
		</motion.div>
	);
}
