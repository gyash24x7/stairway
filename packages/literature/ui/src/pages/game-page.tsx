import { AppFooter, AppMain, initializeSocketForNamespace, subscribeToEvents } from "@common/ui";
import { useGameEventHandlers, useGameId, usePlayerId, usePlayerSpecificEventHandlers } from "@literature/store";
import { Fragment, useEffect } from "react";
import { GameActions, GameCode, GamePageContent } from "../components";

export function GamePage() {
	const gameId = useGameId();
	const playerId = usePlayerId();
	const gameEventHandlers = useGameEventHandlers();
	const playerEventHandlers = usePlayerSpecificEventHandlers();

	useEffect( () => {
		initializeSocketForNamespace( "literature" );
		const unsubscribe = subscribeToEvents(
			"literature",
			gameId,
			playerId,
			gameEventHandlers,
			playerEventHandlers
		);

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
