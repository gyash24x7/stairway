import { DisplayCard } from "@/components/main/display-card";
import { getCardId } from "@/libs/cards/card";
import type { PlayingCard } from "@/libs/cards/types";

export type SelectCardProps = {
	cards: PlayingCard[];
	selectedCards: string[];
	onSelect: ( cardId: string ) => void;
	onDeselect: ( cardId: string ) => void;
}

export function SelectCard( props: SelectCardProps ) {

	const handleCardClick = ( card: PlayingCard ) => {
		const cardId = getCardId( card );
		if ( props.selectedCards.includes( cardId ) ) {
			props.onDeselect( cardId );
		} else {
			props.onSelect( cardId );
		}
	};

	return (
		<div className={ "flex gap-3 flex-wrap" }>
			{ props.cards.map( ( card ) => (
				<div
					key={ getCardId( card ) }
					onClick={ () => handleCardClick( card ) }
					className={ "cursor-pointer rounded-md" }
				>
					<DisplayCard
						rank={ card.rank }
						suit={ card.suit }
						focused={ props.selectedCards.includes( getCardId( card ) ) }
					/>
				</div>
			) ) }
		</div>
	);
}
