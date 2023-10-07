import { Box, Divider, Flex, Stack, Title } from "@mantine/core";

import { useCurrentGame } from "../utils";
import { PlayerLobby } from "./player-lobby";

export interface DisplayTeamsProps {
	displayCardCount?: boolean;
}

export function DisplayTeams( { displayCardCount }: DisplayTeamsProps ) {
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
				<Flex justify={ "space-between" } gap={ "16px" }>
					<Title order={ 4 } fz={ "24px" } pb={ 8 } pr={ 8 }>Team { myTeam.name }</Title>
					<Title order={ 4 } fz={ "24px" } pb={ 8 } pr={ 8 }>{ myTeam.score }</Title>
				</Flex>
				<Divider my={ "sm" }/>
				<PlayerLobby
					playerList={ myTeam.members.map( id => players[ id ] ) }
					displayCardCount={ displayCardCount }
				/>
			</Box>
			<Box key={ oppositeTeam.name }>
				<Flex justify={ "space-between" } gap={ "12px" }>
					<Title order={ 4 } fz={ "24px" } pr={ 8 }>Team { oppositeTeam.name }</Title>
					<Title order={ 4 } fz={ "24px" } pr={ 8 }>{ oppositeTeam.score }</Title>
				</Flex>
				<Divider my={ "sm" }/>
				<PlayerLobby
					playerList={ oppositeTeam.members.map( id => players[ id ] ) }
					displayCardCount={ displayCardCount }
				/>
			</Box>
		</Stack>
	);
}