"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import { getPlayableCards } from "@/games/callbreak/shared/utils.ts";
import { getSortedHand } from "@/shared/cards/utils.ts";
import { RCard } from "@/shared/ui/components/card.tsx";
import { SPRING } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { CardId } from "@/shared/cards/schema.ts";

export function HandView() {
	const { data, isMyTurn, selectCard, selectedCard } = useCallbreak();

	const hand = [ ...data.view.hand ];
	const trick = data.view.activeDeal?.tricks[ 0 ];
	const isTrickComplete = !!trick?.winner;
	const isTrickActive = !!trick && !isTrickComplete;

	const playable = isTrickActive
		? getPlayableCards( hand, data.config.trumpSuit, trick )
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
						onClick={ () => isSelectable( cardId ) && selectCard( cardId ) }
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
