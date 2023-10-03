import { useCurrentGame, useCurrentGameMoves, useCurrentPlayer } from "../utils";
import { AskCard } from "./ask-card";
import { CallSet } from "./call-set";
import { PlayerCard } from "./player-card";
import { PreviousMoves } from "./previous-moves";
import { Box, Group, Stack, Title } from "@mantine/core";

export function GameStatus() {
	const { status, players, currentTurn } = useCurrentGame();
	const loggedInPlayer = useCurrentPlayer();
	const moves = useCurrentGameMoves();

	return (
		<Stack py={ 16 } w={ "100%" } gap={ "xxl" }>
			<Box bg={ "light" } p={ 16 } w={ "100%" }>
				{ moves[ 0 ].description }
			</Box>
			{ status === "IN_PROGRESS" && (
				<Group>
					<Title order={ 3 }>TURN:</Title>
					<PlayerCard player={ players[ currentTurn ] }/>
				</Group>
			) }
			<Group>
				<PreviousMoves/>
				{ currentTurn === loggedInPlayer?.id && (
					<Group>
						<AskCard/>
						<CallSet/>
					</Group>
				) }
			</Group>
		</Stack>
	);
}