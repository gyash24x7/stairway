import { Box, Divider, Flex, Stack, Text, Title } from "@mantine/core";

import { useCurrentGame } from "../utils";
import { PlayerLobby } from "./player-lobby";

export function DisplayTeams() {
	const { myTeam, oppositeTeam, players } = useCurrentGame();

	if ( !myTeam || !oppositeTeam ) {
		return (
			<Stack>
				<Title>Team Not Created Yet!</Title>
			</Stack>
		);
	}

	return (
		<Stack>
			<Box key={ myTeam.name }>
				<Flex justify={ "spaceBetween" }>
					<Text fw={ 600 } pb={ 8 } pr={ 8 }>Team { myTeam.name }</Text>
					<Text fw={ 600 } pb={ 8 } pr={ 8 }>{ myTeam.score }</Text>
				</Flex>
				<Divider my={ "sm" }/>
				<PlayerLobby playerList={ myTeam.members.map( id => players[ id ] ) } displayCardCount/>
			</Box>
			<Box key={ oppositeTeam.name }>
				<Flex justify={ "spaceBetween" }>
					<Text fw={ 600 } pb={ 8 } pr={ 8 }>Team { oppositeTeam.name }</Text>
					<Text fw={ 600 } pb={ 8 } pr={ 8 }>{ oppositeTeam.score }</Text>
				</Flex>
				<Divider my={ "sm" }/>
				<PlayerLobby playerList={ oppositeTeam.members.map( id => players[ id ] ) } displayCardCount/>
			</Box>
		</Stack>
	);
}