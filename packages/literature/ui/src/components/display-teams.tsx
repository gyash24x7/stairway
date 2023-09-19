import { Box, Divider, Flex, Stack, Text } from "@mantine/core";

import { useCurrentGame } from "../utils";
import { PlayerLobby } from "./player-lobby";

export function DisplayTeams() {
	const { teamList, players } = useCurrentGame();

	return (
		<Stack>
			{ teamList.map( team => (
				<Box key={ team.name }>
					<Flex justify={ "spaceBetween" }>
						<Text fw={ 600 } pb={ 8 } pr={ 8 }>Team { team.name }</Text>
						<Text fw={ 600 } pb={ 8 } pr={ 8 }>{ team.score }</Text>
					</Flex>
					<Divider my={ "sm" }/>
					<PlayerLobby playerList={ team.members.map( id => players[ id ] ) } displayCardCount/>
				</Box>
			) ) }
		</Stack>
	);
}