import { Card } from "@common/ui";
import type { Team } from "@literature/data";
import { Flex, Title } from "@mantine/core";
import { usePlayers } from "../store";
import { DisplayPlayerSmall } from "./display-player";

export interface DisplayTeamProps {
	team: Team;
	displayCardCount?: boolean;
}

export function DisplayTeam( { displayCardCount, team }: DisplayTeamProps ) {
	const players = usePlayers();

	return (
		<Card>
			<Flex justify={ "space-between" } gap={ "16px" }>
				<Title order={ 4 } fz={ "24px" } pb={ 8 } pr={ 8 }>Team { team.name }</Title>
				<Title order={ 4 } fz={ "24px" } pb={ 8 } pr={ 8 }>{ team.score }</Title>
			</Flex>
			{ team.memberIds.map( memberId => (
				<DisplayPlayerSmall
					key={ memberId }
					player={ players[ memberId ] }
					displayCardCount={ displayCardCount }
				/>
			) ) }
		</Card>
	);
}