import { Box, Flex, Title } from "@mantine/core";
import { type PlayingCard, sortCards } from "@s2h/cards";
import { DisplayCard } from "./display-card";

export interface DisplayHandProps {
	hand: PlayingCard[];
}

export function DisplayHand( { hand }: DisplayHandProps ) {
	return (
		<Box py={ 8 } w={ "100%" }>
			<Title order={ 2 }>Your Hand</Title>
			<Flex gap={ "sm" } wrap={ "wrap" }>
				{ sortCards( hand ).map( card => (
					<DisplayCard card={ card } key={ card.id }/>
				) ) }
			</Flex>
		</Box>
	);
}