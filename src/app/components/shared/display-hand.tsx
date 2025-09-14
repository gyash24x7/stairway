import { DisplayCard } from "@/app/components/shared/display-card";
import type { PlayingCard } from "@/utils/cards";
import { getCardId, getSortedHand } from "@/utils/cards";

export function DisplayHand( { hand }: { hand: PlayingCard[] } ) {
	return (
		<div className={ "border-2 rounded-md p-2 md:p-3 flex gap-2 md:gap-3 flex-wrap justify-center bg-white" }>
			{ getSortedHand( hand ).map( getCardId ).map( ( cardId ) => (
				<DisplayCard key={ cardId } cardId={ cardId }/>
			) ) }
			{ hand.length === 0 && <h2>NO CARDS LEFT</h2> }
		</div>
	);
}