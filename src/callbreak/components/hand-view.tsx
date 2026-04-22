"use client";

import { useCallbreak } from "@/callbreak/components/context";
import { getPlayableCards } from "@/callbreak/core/utils";
import { RCard } from "@/shared/components/card";
import { type CardId, getSortedHand } from "@/shared/utils/cards";
import { cn } from "@/shared/utils/cn";

export function HandView() {
	const { shared, player, isMyTurn, selectCard, selectedCard } = useCallbreak();
	const deal = shared.state.activeDeal;
	const trick = deal?.tricks[ 0 ];

	const isTrickComplete = !!trick?.winner;

	const isSelectionAllowed = ( cardId: CardId ) => {
		if ( isTrickComplete ) {
			return true;
		}
		const playableCards = getPlayableCards( player.hand, shared.config.trumpSuit, trick! );
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
		<div
			className={ cn(
				"rounded-md p-2 md:p-3 flex gap-2 md:gap-3 flex-wrap justify-center bg-background",
				isTrickActive && isMyTurn && "border-accent border-4"
			) }
		>
			{ getSortedHand( player.hand ).map( ( cardId ) => (
				<div
					key={ cardId }
					className={ cn( "cursor-pointer p-1 z-10", cardId === selectedCard && "bg-accent rounded-md" ) }
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
				</div>
			) ) }
			{ player.hand.length === 0 && <h2>NO CARDS LEFT</h2> }
		</div>
	);
}
