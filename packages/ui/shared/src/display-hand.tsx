import { type CardId, getSortedHand } from "@s2h/utils/cards";
import { DisplayCard } from "./display-card.tsx";

export function DisplayHand( { hand }: { hand: CardId[] } ) {
	return (
		<div className={ "border-2 rounded-md p-2 md:p-3 flex gap-2 md:gap-3 flex-wrap justify-center" }>
			{ getSortedHand( hand ).map( ( cardId ) => (
				<DisplayCard key={ cardId } cardId={ cardId }/>
			) ) }
			{ hand.length === 0 && <h2>NO CARDS LEFT</h2> }
		</div>
	);
}