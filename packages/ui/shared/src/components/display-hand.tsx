import { CardHand } from "@common/cards";
import { Box, Heading, HStack } from "@gluestack-ui/themed";
import { DisplayCard } from "./display-card";

export const DisplayHand = ( { hand }: { hand: CardHand } ) => {
	return (
		<Box borderWidth={ "$2" } borderColor={ "$borderDark100" } borderRadius={ "$md" } p={ "$3" }>
			<Heading>YOUR HAND</Heading>
			<HStack gap={ "$3" } flexWrap={ "wrap" } mt={ "$3" }>
				{ hand.sorted().map( card => <DisplayCard card={ card } key={ card.id }/> ) }
				{ hand.cards.length === 0 && <Heading>No Cards Left</Heading> }
			</HStack>
		</Box>
	);
};