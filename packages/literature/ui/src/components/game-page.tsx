import { LiteratureGameStatus } from "@literature/data";
import { Avatar, Box, Flex, Group, Loader, Stack, Text } from "@mantine/core";
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
import { CardHand } from "@s2h/cards";

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
	const { status, creator, playerList } = useCurrentGame();
	const loggedInPlayer = useCurrentPlayer();
	const { hand } = useCurrentGameHandData();

	const renderBasedOnStatus = () => {
		switch ( status ) {
			case LiteratureGameStatus.CREATED:
				return [
					<PlayerLobby playerList={ playerList } displayHeading/>,
					<Banner message={ "Waiting For Players to Join" } isLoading/>
				];
			case LiteratureGameStatus.PLAYERS_READY:
				return [
					<PlayerLobby playerList={ playerList } displayHeading/>,
					<Fragment>
						{ loggedInPlayer?.id !== creator.id
							? <Banner message={ `Waiting For Teams to get Created` } isLoading/>
							: <CreateTeams/>
						}
					</Fragment>
				];
			case LiteratureGameStatus.TEAMS_CREATED:
				return [
					<DisplayTeams/>,
					<Fragment>
						{ loggedInPlayer?.id !== creator.id
							? <Banner message={ `Waiting for the game to Start` } isLoading/>
							: <StartGame/>
						}
					</Fragment>
				];
			case LiteratureGameStatus.IN_PROGRESS:
			case LiteratureGameStatus.COMPLETED:
				return [ <DisplayTeams/> ];
			default:
				return [];
		}
	};

	return (
		<Flex w={ "100vw" } h={ "100vh" }>
			<Stack className={ classnames.stack } w={ "33%" } h={ "100%" } p={ 20 }>
				<Flex justify={ "space-between" } align={ "center" }>
					<img src={ "logo.png" } width={ 80 } height={ 80 } alt={ "literature" }/>
					<Avatar size={ "lg" } src={ user?.avatar }/>
				</Flex>
				<GameDescription/>
				{ renderBasedOnStatus() }
			</Stack>
			<Flex p={ 20 } h={ "100%" } direction={ "column" } justify={ "space-between" }>
				{ status === LiteratureGameStatus.IN_PROGRESS && (
					<Fragment>
						<DisplayHand hand={ hand ?? CardHand.empty() }/>
						<GameStatus/>
					</Fragment>
				) }
				{ status === LiteratureGameStatus.COMPLETED && <GameCompleted/> }
			</Flex>
		</Flex>
	);
}