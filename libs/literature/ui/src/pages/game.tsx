import { LiteratureGameStatus } from "@s2h/literature/utils";
import { Avatar, Banner, Flex, VStack } from "@s2h/ui";
import { Fragment, useMemo } from "react";
import { useWindowSize } from "react-use";
import {
	CreateTeams,
	DisplayHand,
	DisplayTeams,
	GameCompleted,
	GameDescription,
	GameStatus,
	PlayerLobby,
	StartGame
} from "../components";
import { useAuth, useGame } from "../utils";

export function GamePage() {
	const { user } = useAuth();
	const { status, creator, players } = useGame();
	const loggedInPlayer = useMemo( () => players[ user!.id ], [ players, user ] );

	const { width } = useWindowSize();

	const renderBasedOnStatus = () => {
		switch ( status ) {
			case LiteratureGameStatus.CREATED:
				return [
					<PlayerLobby/>,
					<Banner message={ "Waiting For Players to Join" } isLoading className={ "mt-4" }/>
				];
			case LiteratureGameStatus.PLAYERS_READY:
				return [
					<PlayerLobby/>,
					<Fragment>
						{ loggedInPlayer?.id !== creator.id
							? <Banner
								message={ `Waiting For Teams to get Created` }
								className={ "mt-4" }
								isLoading
							/>
							: <CreateTeams/>
						}
					</Fragment>
				];
			case LiteratureGameStatus.TEAMS_CREATED:
				return [
					<DisplayTeams/>,
					<Fragment>
						{ loggedInPlayer?.id !== creator.id
							? <Banner
								message={ `Waiting for the game to Start` }
								className={ "mt-4" }
								isLoading
							/>
							: <StartGame/>
						}
					</Fragment>
				];
			case LiteratureGameStatus.IN_PROGRESS:
				return [
					<DisplayTeams/>,
					<Fragment>
						{ width < 1024 && <DisplayHand/> }
						{ width < 1024 && <GameStatus/> }
					</Fragment>
				];
			case LiteratureGameStatus.COMPLETED:
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
		<Flex className={ "lg:h-screen w-screen bg-light-300 divide-x divide-dashed divide-light-700 bg-light-200" }>
			<VStack
				className={ "p-5 lg:w-1/3 w-full divide-light-700 divide-y divide-dashed lg:h-full bg-light-100" }
			>
				<Flex justify={ "space-between" } align={ "center" }>
					<img
						src={ "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/literature-icon.png" }
						width={ 80 }
						height={ 80 }
						alt={ "literature" }
					/>
					<Avatar size={ "lg" } src={ user?.avatar } name={ user?.name }/>
				</Flex>
				<GameDescription/>
				{ renderBasedOnStatus() }
			</VStack>
			{ width > 1024 && (
				<Flex className={ "h-full p-5 flex-1" } direction={ "col" } justify={ "space-between" }>
					{ status === LiteratureGameStatus.IN_PROGRESS && (
						<Fragment>
							<DisplayHand/>
							<GameStatus/>
						</Fragment>
					) }
					{ status === LiteratureGameStatus.COMPLETED && <GameCompleted/> }
				</Flex>
			) }
		</Flex>
	);
}