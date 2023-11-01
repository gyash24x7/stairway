import { Flex, Title } from "@mantine/core";
import { type PlayingCard, sortCards } from "@s2h/cards";
import { Card } from "./card";
import { DisplayCard } from "./display-card";

export interface DisplayHandProps {
	hand: PlayingCard[];
}

export function DisplayHand( { hand }: DisplayHandProps ) {
	return (
		<Card>
			<Title order={ 2 } pb={ 8 }>Your Hand</Title>
			<Flex gap={ "sm" } wrap={ "wrap" }>
				{ sortCards( hand ).map( card => (
					<DisplayCard card={ card } key={ card.id }/>
				) ) }
			</Flex>
		</Card>
	);
}