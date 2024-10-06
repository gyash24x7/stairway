import { CardHand } from "@stairway/cards";
import { DisplayCard } from "./display-card.tsx";

export type DisplayHandProps = { hand: CardHand };

export const DisplayHand = ( { hand }: DisplayHandProps ) => {
	return (
		<div className={ "border-2 rounded-md p-3 flex gap-3 flex-wrap" }>
			{ hand.sorted().map( ( { suit, rank, id } ) => (
				<DisplayCard key={ id } suit={ suit } rank={ rank }/>
			) ) }
			{ hand.size === 0 && <h2>No Cards Left</h2> }
		</div>
	);
};