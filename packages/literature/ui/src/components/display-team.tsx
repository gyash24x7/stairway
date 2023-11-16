import type { TeamWithMembers } from "@literature/types";
import { usePlayers } from "@literature/ui";
import { Flex, Title } from "@mantine/core";
import { Card } from "@s2h/ui";
import { DisplayPlayerSmall } from "./display-player";

export interface DisplayTeamProps {
	team: TeamWithMembers;
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
			{ team.members.map( memberId => (
				<DisplayPlayerSmall
					key={ memberId }
					player={ players[ memberId ] }
					displayCardCount={ displayCardCount }
				/>
			) ) }
		</Card>
	);
}