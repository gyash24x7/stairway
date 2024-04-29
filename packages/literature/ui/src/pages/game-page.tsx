import { AppFooter, AppMain, initializeSocket } from "@common/ui";
import { Button } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect } from "react";
import { io } from "socket.io-client";
import { GameActions, GameCode, GamePageContent } from "../components";
import { useGameEventHandlers, useGameId, useGameStatus, usePlayerId, usePlayerSpecificEventHandlers } from "../store";

export function GamePage() {
	const gameId = useGameId();
	const status = useGameStatus();
	const playerId = usePlayerId();
	const gameEventHandlers = useGameEventHandlers();
	const playerEventHandlers = usePlayerSpecificEventHandlers();
	const navigate = useNavigate();

	const redirectToLiteratureHome = async () => {
		await navigate( { to: "/literature" } );
	};

	useEffect( () => {
		const socket = io( `http://localhost:8000/literature` );
		const unsubscribe = initializeSocket( socket, gameId, playerId, gameEventHandlers, playerEventHandlers );
		return () => unsubscribe();
	}, [] );

	return (
		<Fragment>
			<AppMain>
				<GamePageContent/>
			</AppMain>
			<AppFooter>
				<GameCode/>
				{ status === "COMPLETED"
					? <Button color={ "brand" } fw={ 700 } onClick={ redirectToLiteratureHome }>PLAY AGAIN</Button>
					: <GameActions/>
				}
			</AppFooter>
		</Fragment>
	);
}
