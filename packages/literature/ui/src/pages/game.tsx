import { AppShell } from "@mantine/core";
import { AppFooter, AppHeader, AppMain, initializeSocketForNamespace, subscribeToEvents } from "@s2h/ui";
import { useEffect } from "react";
import { GameActions, GameCode, GamePageContent } from "../components";
import { useGameEventHandlers, useGameId, usePlayerId, usePlayerSpecificEventHandlers } from "../store";

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
		<AppShell>
			<AppHeader/>
			<AppMain>
				<GamePageContent/>
			</AppMain>
			<AppFooter>
				<GameCode/>
				<GameActions/>
			</AppFooter>
		</AppShell>
	);
}