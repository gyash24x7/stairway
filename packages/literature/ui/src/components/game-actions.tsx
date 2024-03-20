import { Box, Flex, Group, Text } from "@mantine/core";
import { Fragment } from "react";
import { useCurrentTurn, useGameStatus, useMoves, usePlayerId, usePlayers } from "../store";
import { AddBots } from "./add-bots";
import { AskCard } from "./ask-card";
import { CallSet } from "./call-set";
import { CreateTeams } from "./create-teams";
import { ExecuteBotMove } from "./execute-bot-move";
import { PreviousMoves } from "./previous-moves";
import { StartGame } from "./start-game";
import { TransferTurn } from "./transfer-turn";

export function GameActions() {
	const status = useGameStatus();
	const currentTurn = useCurrentTurn();
	const players = usePlayers();
	const moves = useMoves();
	const id = usePlayerId();

	return (
		<Flex justify={ "end" }>
			{ status === "CREATED" && id === currentTurn && <AddBots/> }
			{ status === "PLAYERS_READY" && id === currentTurn && <CreateTeams/> }
			{ status === "TEAMS_CREATED" && id === currentTurn && <StartGame/> }
			{ status === "IN_PROGRESS" && (
				<Box>
					<Text ta={ "right" } style={ { flex: 1 } } fw={ 700 } fz={ 20 }>
						IT'S { players[ currentTurn ].name.toUpperCase() }'S TURN!
					</Text>
					<Group>
						<PreviousMoves/>
						{ currentTurn === id ? (
							<Fragment>
								<AskCard/>
								<CallSet/>
								{ !!moves[ 0 ] && moves[ 0 ].type === "CALL_SET" && moves[ 0 ].success && (
									<TransferTurn/>
								) }
							</Fragment>
						) : <ExecuteBotMove/> }
					</Group>
				</Box>
			) }
		</Flex>
	);
}