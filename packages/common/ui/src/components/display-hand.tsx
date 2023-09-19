import { DisplayCard } from "./display-card";
import type { CardHand } from "@s2h/cards";
import { Box, Flex, Title } from "@mantine/core";

export interface DisplayHandProps {
	hand: CardHand;
}

export function DisplayHand( { hand }: DisplayHandProps ) {
	return (
		<Box py={ 8 } w={ "100%" }>
			<Title order={ 2 }>Your Hand</Title>
			<Flex gap={ "sm" } wrap={ "wrap" }>
				{ hand.sorted().map( card => (
					<DisplayCard card={ card } key={ card.cardId }/>
				) ) }
			</Flex>
		</Box>
	);
}