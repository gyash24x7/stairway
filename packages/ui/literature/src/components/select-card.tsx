import { PlayingCard } from "@common/cards";
import { HStack, Pressable, ScrollView } from "@gluestack-ui/themed";
import { DisplayCard } from "@shared/ui";

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
		<ScrollView horizontal>
			<HStack gap={ "$3" }>
				{ cards.map( ( card ) => (
					<Pressable
						key={ card.id }
						onPress={ () => handleCardClick( card.id ) }
						bg={ selectedCards.includes( card.id ) ? "$blue100" : "$backgroundLight50" }
					>
						<DisplayCard card={ card }/>
					</Pressable>
				) ) }
			</HStack>
		</ScrollView>
	);
}
