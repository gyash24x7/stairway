import { AskCard } from "./ask-card";
import { CallSet } from "./call-set";
import { PlayerCard } from "./player-card";
import { PreviousMoves } from "./previous-moves";
import { Box, Group, Stack, Title } from "@mantine/core";
import { TransferTurn } from "./transfer-turn";
import { gameStatusClassnames } from "../styles";
import { useGameStore } from "../utils";

export function GameStatus() {
	const status = useGameStore( state => state.gameData!.status );
	const players = useGameStore( state => state.gameData!.players );
	const currentTurn = useGameStore( state => state.gameData!.currentTurn );
	const playerId = useGameStore( state => state.playerData!.id );
	const moves = useGameStore( state => state.gameData!.moves );

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
				{ currentTurn === playerId && (
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