import { GameStatus } from "@literature/types";
import { useGameStatus, useHand, usePlayers } from "@literature/ui";
import { Flex, Grid } from "@mantine/core";
import { Banner, DisplayHand } from "@s2h/ui";
import { GameCompleted, GameDescription, PlayerLobby } from "../components";

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

export function GamePageContent() {
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