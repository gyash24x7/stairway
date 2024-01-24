import { AppFooter, AppMain, initializeSocket } from "@common/ui";
import { Fragment, useEffect } from "react";
import { io } from "socket.io-client";
import { GameActions, GameCode, GamePageContent } from "../components";
import { useGameEventHandlers, useGameId, usePlayerId, usePlayerSpecificEventHandlers } from "../store";

export function GamePage() {
	const gameId = useGameId();
	const playerId = usePlayerId();
	const gameEventHandlers = useGameEventHandlers();
	const playerEventHandlers = usePlayerSpecificEventHandlers();

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
				<GameActions/>
			</AppFooter>
		</Fragment>
	);
}
