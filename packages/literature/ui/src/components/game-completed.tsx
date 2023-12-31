import { Card } from "@common/ui";
import { useMyTeam, useOppositeTeam } from "@literature/store";
import { Stack, Title } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";

export function GameCompleted() {
	const oppositeTeam = useOppositeTeam();
	const myTeam = useMyTeam();

	return (
		<Card>
			<Stack gap={ "xxl" } justify={ "center" } align={ "center" } w={ "100%" } h={ "100%" }>
				<IconCircleCheck width={ "25%" } height={ "25%" }/>
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