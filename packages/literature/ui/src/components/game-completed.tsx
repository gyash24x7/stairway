import { useMyTeam, useOppositeTeam } from "@literature/ui";
import { Stack, Title } from "@mantine/core";
import { Card } from "@s2h/ui";
import { IconCircleCheck } from "@tabler/icons-react";

export function GameCompleted() {
	const oppositeTeam = useOppositeTeam();
	const myTeam = useMyTeam();

	return (
		<Card>
			<Stack gap={ "xxl" } justify={ "center" } align={ "center" } w={ "100%" } h={ "100%" }>
				<IconCircleCheck width={ "50%" } height={ "50%" }/>
				<Title>Game Completed</Title>
				{ myTeam!.score > oppositeTeam!.score && (
					<Title>Team { myTeam?.name } Won!</Title>
				) }
				{ oppositeTeam!.score > myTeam!.score && (
					<Title>Team { oppositeTeam?.name } Won!</Title>
				) }
				{ oppositeTeam!.score === myTeam!.score && (
					<Title>Match Tied!</Title>
				) }
			</Stack>
		</Card>
	);
}