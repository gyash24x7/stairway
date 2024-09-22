import { cn } from "@base/components";
import { PlayingCard } from "@stairway/cards";
import React from "react";
import { DisplayCard } from "./display-card.tsx";

export type SelectCardProps = {
	cards: PlayingCard[];
	selectedCards: string[];
	onSelect: ( cardId: string ) => void;
	onDeselect: ( cardId: string ) => void;
}

export function SelectCard( { cards, onSelect, onDeselect, selectedCards }: SelectCardProps ) {

	const handleCardClick = ( cardId: string ) => {
		if ( selectedCards.includes( cardId ) ) {
			onDeselect( cardId );
		} else {
			onSelect( cardId );
		}
	};

	return (
		<div className={ "flex gap-3" }>
			{ cards.map( ( card ) => (
				<div
					key={ card.id }
					onClick={ () => handleCardClick( card.id ) }
					className={ cn(
						selectedCards.includes( card.id ) ? "bg-blue-100" : "bg-gray-100",
						"cursor-pointer"
					) }
				>
					<DisplayCard rank={ card.rank } suit={ card.suit }/>
				</div>
			) ) }
		</div>
	);
}
