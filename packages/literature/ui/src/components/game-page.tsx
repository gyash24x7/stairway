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
import { useGameStore } from "../utils";

export function GamePage() {
	const status = useGameStore( state => state.gameData!.status );
	const players = useGameStore( state => state.gameData!.players );
	const currentTurn = useGameStore( state => state.gameData!.currentTurn );
	const playerId = useGameStore( state => state.playerData!.id );
	const playerAvatar = useGameStore( state => state.playerData!.avatar );
	const playerName = useGameStore( state => state.playerData!.name );
	const hand = useGameStore( state => state.playerData!.hand );

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
						{ playerId !== currentTurn
							? <Banner message={ `Waiting For Teams to get Created` } isLoading/>
							: <CreateTeams/>
						}
					</Fragment>
				);
			case "TEAMS_CREATED":
				return (
					<Fragment>
						<DisplayTeams/>
						{ playerId !== currentTurn
							? <Banner message={ `Waiting for the game to Start` } isLoading/>
							: <StartGame/>
						}
					</Fragment>
				);
			case "IN_PROGRESS":
			case "COMPLETED":
				return <DisplayTeams displayCardCount/>;
		}
		return null;
	};

	return (
		<Flex w={ "100vw" } h={ "100vh" }>
			<Stack className={ classnames.stack } w={ "33%" } h={ "100%" } p={ 20 }>
				<Flex justify={ "space-between" } align={ "center" }>
					<img src={ "logo.png" } width={ 120 } height={ 120 } alt={ "literature" }/>
					<Flex gap={ "xs" } align={ "center" } justify={ "center" } direction={ "column" }>
						<Avatar size={ "lg" } src={ playerAvatar }/>
						<Title order={ 4 }>{ playerName }</Title>
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