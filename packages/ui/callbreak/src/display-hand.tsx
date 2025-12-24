import { cn } from "@s2h-ui/primitives/utils";
import { DisplayCard } from "@s2h-ui/shared/display-card";
import { getPlayableCards } from "@s2h/callbreak/utils";
import { type CardId, getSortedHand } from "@s2h/utils/cards";
import { useStore } from "@tanstack/react-store";
import { handleCardSelect, store } from "./store.tsx";

export function DisplayHand() {
	const trump = useStore( store, state => state.trump );
	const currentRound = useStore( store, state => state.currentRound );
	const hand = useStore( store, state => state.hand );
	const playerId = useStore( store, state => state.playerId );
	const currentTurn = useStore( store, state => state.currentTurn );
	const selectedCard = useStore( store, state => state.play.selectedCard );
	const isSelectionAllowed = ( cardId: CardId ) => {
		const playableCards = getPlayableCards( hand, trump, currentRound! );
		return playableCards.includes( cardId );
	};

	const isActiveRound = currentRound && Object.keys( currentRound.cards ).length !== 4;

	const handleCardClick = ( cardId: CardId ) => () => {
		if ( !currentRound ) {
			return;
		}

		if ( isSelectionAllowed( cardId ) && currentTurn === playerId ) {
			handleCardSelect( selectedCard === cardId ? undefined : cardId );
		}
	};

	return (
		<div
			className={ cn(
				"border-2 rounded-md p-2 md:p-3 flex gap-2 md:gap-3 flex-wrap justify-center",
				isActiveRound && currentTurn === playerId && "bg-background border-accent border-4"
			) }
		>
			{ getSortedHand( hand ).map( ( cardId ) => (
				<div
					key={ cardId }
					className={ cn( "cursor-pointer p-1 z-10", cardId === selectedCard && "bg-accent rounded-md" ) }
					onClick={ handleCardClick( cardId ) }
				>
					<div
						className={ cn(
							"absolute w-16 md:w-20 p-1 md:p-1.5 h-24 md:h-30 rounded-md",
							( isActiveRound && !isSelectionAllowed( cardId ) && currentTurn === playerId ) &&
							"cursor-not-allowed bg-gray-500 opacity-50"
						) }
					/>
					<DisplayCard cardId={ cardId }/>
				</div>
			) ) }
			{ hand.length === 0 && <h2>NO CARDS LEFT</h2> }
		</div>
	);
}
