import { Avatar, Box, Flex, Group, Loader, Stack, Text, Title } from "@mantine/core";
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
import { useCurrentGame, useCurrentGameHandData, useCurrentPlayer } from "../utils";
import { useAuth } from "@auth/ui";
import { gamePageClassnames as classnames } from "../styles";
import { DisplayHand } from "@s2h/ui";

interface BannerProps {
	isLoading?: boolean;
	message: string;
}

export function Banner( { message, isLoading }: BannerProps ) {
	return (
		<Box p={ 16 } w={ "100%" }>
			<Group>
				{ isLoading && <Loader size={ "sm" }/> }
				<Text>{ message }</Text>
			</Group>
		</Box>
	);
}

export function GamePage() {
	const { user } = useAuth();
	const { status, currentTurn, players } = useCurrentGame();
	const loggedInPlayer = useCurrentPlayer();
	const { hand } = useCurrentGameHandData();

	const renderBasedOnStatus = () => {
		switch ( status ) {
			case "CREATED":
				return (
					<Fragment>
						<PlayerLobby playerList={ Object.values( players ) } displayHeading/>
						<Banner message={ "Waiting For Players to Join" } isLoading/>
					</Fragment>
				);
			case "PLAYERS_READY":
				return (
					<Fragment>
						<PlayerLobby playerList={ Object.values( players ) } displayHeading/>
						{ loggedInPlayer?.id !== currentTurn
							? <Banner message={ `Waiting For Teams to get Created` } isLoading/>
							: <CreateTeams/>
						}
					</Fragment>
				);
			case "TEAMS_CREATED":
				return (
					<Fragment>
						<DisplayTeams/>
						{ loggedInPlayer?.id !== currentTurn
							? <Banner message={ `Waiting for the game to Start` } isLoading/>
							: <StartGame/>
						}
					</Fragment>
				);
			case "IN_PROGRESS":
			case "COMPLETED":
				return <DisplayTeams displayCardCount/>;
		}
	};

	return (
		<Flex w={ "100vw" } h={ "100vh" }>
			<Stack className={ classnames.stack } w={ "33%" } h={ "100%" } p={ 20 }>
				<Flex justify={ "space-between" } align={ "center" }>
					<img src={ "logo.png" } width={ 120 } height={ 120 } alt={ "literature" }/>
					<Flex gap={ "xs" } align={ "center" } justify={ "center" } direction={ "column" }>
						<Avatar size={ "lg" } src={ user?.avatar }/>
						<Title order={ 4 }>{ user?.name }</Title>
					</Flex>
				</Flex>
				<GameDescription/>
				{ renderBasedOnStatus() }
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