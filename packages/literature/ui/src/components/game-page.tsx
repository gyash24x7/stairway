import { GameStatus, MoveType } from "@literature/types";
import { Box, Flex, Grid, Group, Text, Title } from "@mantine/core";
import { Banner, DisplayHand } from "@s2h/ui";
import {
	AddBots,
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
import { useCurrentTurn, useGameCode, useGameStatus, useHand, useMoves, usePlayerData, usePlayers } from "../store";

function getBannerMessage( status: GameStatus ) {
	switch ( status ) {
		case GameStatus.CREATED:
			return "Waiting for players to join";
		case GameStatus.PLAYERS_READY:
			return "Waiting for teams to get created";
		case GameStatus.TEAMS_CREATED:
			return "Waiting for the game to Start";
		case GameStatus.IN_PROGRESS:
			return "Waiting for the player to make a move";
		case GameStatus.COMPLETED:
			return "";
	}
}

export function GamePage() {
	const status = useGameStatus();
	const players = usePlayers();
	const hand = useHand();

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
						displayCardCount={ status === GameStatus.IN_PROGRESS }
					/>
					<Banner message={ getBannerMessage( status ) } isLoading/>
				</Flex>
			</Grid.Col>
			<Grid.Col span={ 8 }>
				{ status === GameStatus.IN_PROGRESS && <DisplayHand hand={ hand }/> }
				{ status === GameStatus.COMPLETED && <GameCompleted/> }
			</Grid.Col>
		</Grid>
	);
}

export function GamePageFooter() {
	const status = useGameStatus();
	const currentTurn = useCurrentTurn();
	const players = usePlayers();
	const moves = useMoves();
	const code = useGameCode();
	const { id } = usePlayerData();

	return (
		<Flex mih={ 100 } justify={ "space-between" } c={ "white" } align={ "center" }>
			<Box>
				<Text fz={ 14 } fw={ 700 } lh={ 1 }>GAME CODE</Text>
				<Title fz={ 56 } lh={ 1 }>{ code }</Title>
			</Box>
			<Flex justify={ "end" }>
				{ status === GameStatus.CREATED && id === currentTurn && <AddBots/> }
				{ status === GameStatus.PLAYERS_READY && id === currentTurn && <CreateTeams/> }
				{ status === GameStatus.TEAMS_CREATED && id === currentTurn && <StartGame/> }
				{ status === GameStatus.IN_PROGRESS && (
					<Box>
						<Text ta={ "right" } style={ { flex: 1 } } fw={ 700 } fz={ 20 }>
							IT'S { players[ currentTurn ].name.toUpperCase() }'S TURN!
						</Text>
						{ currentTurn === id && (
							<Group>
								<PreviousMoves/>
								<AskCard/>
								<CallSet/>
								{ !!moves[ 0 ] && moves[ 0 ].type === MoveType.CALL_SET && moves[ 0 ].success && (
									<TransferTurn/>
								) }
							</Group>
						) }
					</Box>
				) }
			</Flex>
		</Flex>
	);
}
