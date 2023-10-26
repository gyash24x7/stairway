import { useGameStore } from "../utils";
import { Avatar, Box, Flex, Text, Title } from "@mantine/core";
import type { Player } from "@literature/types";

export interface PlayerLobbyProps {
	playerList: Player[];
	displayHeading?: boolean;
	displayCardCount?: boolean;
}

export function PlayerLobby( { playerList, displayHeading, displayCardCount }: PlayerLobbyProps ) {
	const cardCounts = useGameStore( state => state.gameData!.cardCounts );
	return (
		<Box my={ 8 } w={ "100%" }>
			{ !!displayHeading && <Title order={ 4 } fz={ "24px" } pb={ 8 }>Players Joined</Title> }
			{ playerList.map( player => (
				<Flex py={ 8 } w={ "100%" } align={ "center" } gap={ "md" } key={ player.id }>
					<Avatar size={ "28px" } src={ player.avatar }/>
					<Text>{ player.name }</Text>
					{ !!displayCardCount && Object.values( cardCounts ).some( count => count > 0 ) && (
						<div style={ { flex: 1, textAlign: "right" } }>{ cardCounts[ player.id ] } Cards</div>
					) }
				</Flex>
			) ) }
		</Box>
	);
}