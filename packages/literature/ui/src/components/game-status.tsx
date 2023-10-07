import { useCurrentGame, useCurrentGameMoves, useCurrentPlayer } from "../utils";
import { AskCard } from "./ask-card";
import { CallSet } from "./call-set";
import { PlayerCard } from "./player-card";
import { PreviousMoves } from "./previous-moves";
import { Box, Group, Stack, Title } from "@mantine/core";
import { TransferChance } from "./transfer-chance";
import { gameStatusClassnames } from "../styles";

export function GameStatus() {
	const { status, players, currentTurn } = useCurrentGame();
	const loggedInPlayer = useCurrentPlayer();
	const moves = useCurrentGameMoves();

	return (
		<Stack py={ 16 } w={ "100%" } gap={ "xxl" }>
			{ !!moves[ 0 ] && (
				<Box className={ gameStatusClassnames.banner }>
					{ moves[ 0 ].description }
				</Box>
			) }
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
						{ !!moves[ 0 ] && moves[ 0 ].type === "CALL_SET" && moves[ 0 ].success && (
							<TransferChance/>
						) }
					</Group>
				) }
			</Group>
		</Stack>
	);
}