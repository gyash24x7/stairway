import { Fragment } from "react";
import { Avatar, Banner, Flex, VStack } from "@s2h/ui";
import { useGame } from "../utils/game-context";
import LiteratureIcon from "../assets/literature-icon.png";
import { GameDescription } from "../components/game-description";
import { LitGameStatus } from "@prisma/client";
import { PlayerLobby } from "../components/player-lobby";
import { DisplayTeams } from "../components/display-teams";
import { StartGame } from "../components/start-game";
import { CreateTeams } from "../components/create-teams";
import { DisplayHand } from "../components/display-hand";
import { GameStatus } from "../components/game-status";
import { useWindowSize } from "react-use";
import { useAuth } from "../utils/auth";
import { GameCompleted } from "../components/game-completed";

export default function () {
	const { status, creator, loggedInPlayer } = useGame();
	const { user } = useAuth();

	const { width } = useWindowSize();

	const renderBasedOnStatus = () => {
		switch ( status ) {
			case LitGameStatus.NOT_STARTED:
				return [
					<PlayerLobby/>,
					<Banner message = { "Waiting For Players to Join" } isLoading className = { "mt-4" }/>
				];
			case LitGameStatus.PLAYERS_READY:
				return [
					<PlayerLobby/>,
					<Fragment>
						{ loggedInPlayer?.id !== creator.id
							? <Banner message = { `Waiting For Teams to get Created` }
									  className = { "mt-4" }
									  isLoading/>
							: <CreateTeams/>
						}
					</Fragment>
				];
			case LitGameStatus.TEAMS_CREATED:
				return [
					<DisplayTeams/>,
					<Fragment>
						{ loggedInPlayer?.id !== creator.id
							? <Banner message = { `Waiting for the game to Start` } className = { "mt-4" } isLoading/>
							: <StartGame/>
						}
					</Fragment>
				];
			case LitGameStatus.IN_PROGRESS:
				return [
					<DisplayTeams/>,
					<Fragment>
						{ width < 1024 && <DisplayHand/> }
						{ width < 1024 && <GameStatus/> }
					</Fragment>
				];
			case LitGameStatus.COMPLETED:
				return [
					<DisplayTeams/>,
					<Fragment>
						{ width < 1024 && <GameCompleted/> }
					</Fragment>
				];
			default:
				return [];
		}
	};

	return (
		<Flex className = { "lg:h-screen w-screen bg-light-300 divide-x divide-dashed divide-light-700 bg-light-200" }>
			<VStack
				className = { "p-5 lg:w-1/3 w-full divide-light-700 divide-y divide-dashed lg:h-full bg-light-100" }
			>
				<Flex justify = { "space-between" } align = { "center" }>
					<img src = { LiteratureIcon } width = { 80 } height = { 80 } alt = { "literature" }/>
					<Avatar size = { "lg" } src = { user?.avatar } name = { user?.name }/>
				</Flex>
				<GameDescription/>
				{ renderBasedOnStatus() }
			</VStack>
			{ width > 1024 && (
				<Flex className = { "h-full p-5 flex-1" } direction = { "col" } justify = { "space-between" }>
					{ status === LitGameStatus.IN_PROGRESS && (
						<Fragment>
							<DisplayHand/>
							<GameStatus/>
						</Fragment>
					) }
					{ status === LitGameStatus.COMPLETED && <GameCompleted/> }
				</Flex>
			) }
		</Flex>
	);
};