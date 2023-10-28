import { Avatar, Flex, Stack, Title } from "@mantine/core";
import { Banner, DisplayHand } from "@s2h/ui";
import { Fragment } from "react";
import {
	CreateTeams,
	DisplayTeams,
	GameCompleted,
	GameDescription,
	GameStatus,
	PlayerLobby,
	StartGame
} from "../components";
import { gamePageClassnames as classnames } from "../styles";
import { useGameData, usePlayerData } from "../utils";

export function GamePage() {
	const { status, players, currentTurn } = useGameData()!;
	const { hand, name, id, avatar } = usePlayerData()!;

	return (
		<Flex w={ "100vw" } h={ "100vh" }>
			<Stack className={ classnames.stack } w={ "33%" } h={ "100%" } p={ 20 }>
				<Flex justify={ "space-between" } align={ "center" }>
					<img src={ "logo.png" } width={ 120 } height={ 120 } alt={ "literature" }/>
					<Flex gap={ "xs" } align={ "center" } justify={ "center" } direction={ "column" }>
						<Avatar size={ "lg" } src={ avatar }/>
						<Title order={ 4 }>{ name }</Title>
					</Flex>
				</Flex>
				<GameDescription/>
				{ status === "CREATED" && (
					<Fragment>
						<PlayerLobby playerList={ Object.values( players ) } displayHeading/>
						<Banner message={ "Waiting For Players to Join" } isLoading/>
					</Fragment>
				) }

				{ status === "PLAYERS_READY" && (
					<Fragment>
						<PlayerLobby playerList={ Object.values( players ) } displayHeading/>
						<Banner message={ "Waiting For Teams to get Created" } isLoading/>
					</Fragment>
				) }

				{ status === "TEAMS_CREATED" && (
					<Fragment>
						<DisplayTeams/>
						{ id !== currentTurn
							? <Banner message={ `Waiting for the game to Start` } isLoading/>
							: <StartGame/>
						}
					</Fragment>
				) }

				{ status === "IN_PROGRESS" && (
					<Fragment>
						<PlayerLobby playerList={ Object.values( players ) } displayHeading/>
						{ id !== currentTurn
							? <Banner message={ `Waiting For Teams to get Created` } isLoading/>
							: <CreateTeams/>
						}
					</Fragment>
				) }

				{ status === "IN_PROGRESS" && (
					<Fragment>
						<DisplayTeams/>
						<GameStatus/>
					</Fragment>
				) }

				{ status === "COMPLETED" && (
					<Fragment>
						<DisplayTeams/>
						<GameCompleted/>
					</Fragment>
				) }
			</Stack>
			<Flex className={ classnames.playArea }>
				{ status === "IN_PROGRESS" && (
					<Fragment>
						<DisplayHand hand={ hand }/>
						<GameStatus/>
					</Fragment>
				) }
				{ status === "COMPLETED" && <GameCompleted/> }
			</Flex>
		</Flex>
	);
}