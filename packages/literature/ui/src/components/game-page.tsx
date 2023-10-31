import { Box, Flex, Grid, Group, Text, Title } from "@mantine/core";
import { Banner, DisplayHand } from "@s2h/ui";
import { Fragment, useMemo } from "react";
import {
	AskCard,
	CallSet,
	CreateTeams,
	GameCompleted,
	GameDescription,
	PlayerLobby,
	PreviousMoves,
	StartGame,
	TransferTurn
} from "../components";
import { useGameData, usePlayerData } from "../utils";

export function GamePage() {
	const { status, players, moves, currentTurn } = useGameData()!;
	const { hand } = usePlayerData()!;
	const bannerMessage = useMemo( () => {
		return status === "CREATED"
			? "Waiting For Players to Join"
			: status === "PLAYERS_READY"
				? "Waiting For Teams to get Created"
				: status === "TEAMS_CREATED"
					? "Waiting for the game to Start"
					: status === "IN_PROGRESS" && moves.length > 0
						? `Waiting for the ${ players[ currentTurn ].name } to make a move`
						: "";
	}, [ status, moves, players, currentTurn ] );

	return (
		<Grid p={ 10 } gutter={ 10 }>
			<Grid.Col span={ 12 }>
				<GameDescription/>
			</Grid.Col>
			<Grid.Col span={ 4 }>
				<Flex direction={ "column" } gap={ 10 } h={ "100%" }>
					<PlayerLobby
						playerList={ Object.values( players ) }
						displayHeading
						displayCardCount={ status === "IN_PROGRESS" }
					/>
					<Banner message={ bannerMessage } isLoading/>
				</Flex>
			</Grid.Col>
			<Grid.Col span={ 8 }>
				{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
				{ status === "COMPLETED" && <GameCompleted/> }
			</Grid.Col>
		</Grid>
	);
}

export function GamePageFooter() {
	const { status, currentTurn, players, code, moves } = useGameData()!;
	const { id } = usePlayerData()!;

	return (
		<Fragment>
			<Flex mih={ 100 } justify={ "space-between" } c={ "white" } align={ "center" }>
				<Box>
					<Text fz={ 14 } fw={ 700 } lh={ 1 }>GAME CODE</Text>
					<Title fz={ 56 } lh={ 1 }>{ code }</Title>
				</Box>
				<Flex justify={ "end" }>
					{ status === "PLAYERS_READY" && id === currentTurn && <CreateTeams/> }
					{ status === "TEAMS_CREATED" && id === currentTurn && <StartGame/> }
					{ status === "IN_PROGRESS" && (
						<Box>
							<Text ta={ "right" } style={ { flex: 1 } } fw={ 700 } fz={ 20 }>
								IT'S { players[ currentTurn ].name.toUpperCase() }'S TURN!
							</Text>
							{ currentTurn === id && (
								<Group>
									<PreviousMoves/>
									<AskCard/>
									<CallSet/>
									{ !!moves[ 0 ] && moves[ 0 ].type === "CALL_SET" && moves[ 0 ].success && (
										<TransferTurn/>
									) }
								</Group>
							) }
						</Box>
					) }
				</Flex>
			</Flex>

		</Fragment>
	);
}
