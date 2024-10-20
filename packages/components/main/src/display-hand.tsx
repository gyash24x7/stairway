import { getCardId, getSortedHand, type PlayingCard } from "@stairway/cards";
import { DisplayCard } from "./display-card.tsx";

export const DisplayHand = ( { hand }: { hand: PlayingCard[] } ) => {
	return (
		<div className={ "border-2 rounded-md p-3 flex gap-3 flex-wrap" }>
			{ getSortedHand( hand ).map( ( { suit, rank } ) => (
				<DisplayCard key={ getCardId( { rank, suit } ) } suit={ suit } rank={ rank }/>
			) ) }
			{ hand.length === 0 && <h2>No Cards Left</h2> }
		</div>
	);
};