import { DisplayCard } from "@/components/main/display-card";
import { getCardId } from "@/libs/cards/card";
import { getSortedHand } from "@/libs/cards/hand";
import type { PlayingCard } from "@/libs/cards/types";

export function DisplayHand( { hand }: { hand: PlayingCard[] } ) {
	return (
		<div className={ "border-2 rounded-md p-2 md:p-3 flex gap-2 md:gap-3 flex-wrap justify-center bg-white" }>
			{ getSortedHand( hand ).map( ( { suit, rank } ) => (
				<DisplayCard key={ getCardId( { rank, suit } ) } suit={ suit } rank={ rank }/>
			) ) }
			{ hand.length === 0 && <h2>NO CARDS LEFT</h2> }
		</div>
	);
}