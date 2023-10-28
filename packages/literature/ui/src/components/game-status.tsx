import { Box, Group, Stack, Title } from "@mantine/core";
import { gameStatusClassnames } from "../styles";
import { useGameData, usePlayerData } from "../utils";
import { AskCard } from "./ask-card";
import { CallSet } from "./call-set";
import { PlayerCard } from "./player-card";
import { PreviousMoves } from "./previous-moves";
import { TransferTurn } from "./transfer-turn";

export function GameStatus() {
	const { status, moves, players, currentTurn } = useGameData()!;
	const { id } = usePlayerData()!;

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
				{ currentTurn === id && (
					<Group>
						<AskCard/>
						<CallSet/>
						{ !!moves[ 0 ] && moves[ 0 ].type === "CALL_SET" && moves[ 0 ].success && (
							<TransferTurn/>
						) }
					</Group>
				) }
			</Group>
		</Stack>
	);
}