import { Box, Divider, Flex, Stack, Title } from "@mantine/core";
import { useGameData } from "../utils";
import { PlayerLobby } from "./player-lobby";

export interface DisplayTeamsProps {
	displayCardCount?: boolean;
}

export function DisplayTeams( { displayCardCount }: DisplayTeamsProps ) {
	const { teams, players } = useGameData()!;

	if ( Object.keys( teams ).length !== 2 ) {
		return (
			<Stack>
				<Title>Team Not Created Yet!</Title>
			</Stack>
		);
	}

	return (
		<Stack>
			{ Object.values( teams ).map( team => (
				<Box key={ team.id }>
					<Flex justify={ "space-between" } gap={ "16px" }>
						<Title order={ 4 } fz={ "24px" } pb={ 8 } pr={ 8 }>Team { team.name }</Title>
						<Title order={ 4 } fz={ "24px" } pb={ 8 } pr={ 8 }>{ team.score }</Title>
					</Flex>
					<Divider my={ "sm" }/>
					<PlayerLobby
						playerList={ team.members.map( id => players[ id ] ) }
						displayCardCount={ displayCardCount }
					/>
				</Box>
			) ) }
		</Stack>
	);
}