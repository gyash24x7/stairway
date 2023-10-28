import { Stack, Title } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { useGameData, usePlayerData } from "../utils";

export function GameCompleted() {
	const { teams } = useGameData()!;
	const { oppositeTeamId, teamId } = usePlayerData()!;
	const myTeam = teams[ teamId! ];
	const oppositeTeam = teams[ oppositeTeamId! ];

	return (
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
	);
}