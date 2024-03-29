import { Banner, Card, DisplayHand } from "@common/ui";
import type { GameStatus } from "@literature/data";
import { Flex, Grid } from "@mantine/core";
import { useGameStatus, useHand, useMoves, usePlayers } from "../store";
import { GameCompleted } from "./game-completed";
import { GameDescription } from "./game-description";
import { PlayerLobby } from "./player-lobby";

function getBannerMessage( status: GameStatus ) {
	switch ( status ) {
		case "CREATED":
			return "Waiting for players to join";
		case "PLAYERS_READY":
			return "Waiting for teams to get created";
		case "TEAMS_CREATED":
			return "Waiting for the game to Start";
		case "IN_PROGRESS":
			return "Waiting for the player to make a move";
		case "COMPLETED":
			return "";
	}
}

export function GamePageContent() {
	const status = useGameStatus();
	const players = usePlayers();
	const hand = useHand();
	const [ move ] = useMoves();

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
					<Banner message={ getBannerMessage( status ) } isLoading/>
				</Flex>
			</Grid.Col>
			<Grid.Col span={ 8 }>
				<Flex direction={ "column" } gap={ 10 }>
					{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
					{ status === "IN_PROGRESS" && !!move && <Card>{ move.description }</Card> }
					{ status === "COMPLETED" && <GameCompleted/> }
				</Flex>
			</Grid.Col>
		</Grid>
	);
}
