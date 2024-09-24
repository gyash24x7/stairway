import { useHand } from "@literature/store";
import { DisplayCard } from "./display-card.tsx";

export const DisplayHand = () => {
	const hand = useHand();

	return (
		<div className={ "border-2 rounded-md p-3" }>
			<h2 className={ "font-semibold" }>YOUR HAND</h2>
			<div className={ "flex gap-3 flex-wrap mt-3" }>
				{ hand.sorted().map( ( { suit, rank, id } ) => (
					<DisplayCard key={ id } suit={ suit } rank={ rank }/>
				) ) }
				{ hand.size === 0 && <h2>No Cards Left</h2> }
			</div>
		</div>
	);
};