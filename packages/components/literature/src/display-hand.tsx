import { useHand } from "@literature/store";
import { DisplayCard } from "./display-card.tsx";

export const DisplayHand = () => {
	const hand = useHand();

	return (
		<div className={ "border-2 border-gray-300 rounded-md p-3" }>
			<h2>YOUR HAND</h2>
			<div className={ "flex gap-3 flex-wrap mt-3" }>
				{ hand.sorted().map( card => <DisplayCard rank={ card.rank } suit={ card.suit } key={ card.id }/> ) }
				{ hand.size === 0 && <h2>No Cards Left</h2> }
			</div>
		</div>
	);
};