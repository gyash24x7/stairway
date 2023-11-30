import { AppFooter, AppHeader, AppMain, ErrorPage, initializeSocketForNamespace, subscribeToEvents } from "@common/ui";
import {
	gameStoreLoader,
	useGameEventHandlers,
	useGameId,
	usePlayerId,
	usePlayerSpecificEventHandlers
} from "@literature/store";
import { GameActions, GameCode, GamePageContent } from "@literature/ui";
import { AppShell } from "@mantine/core";
import { useEffect } from "react";
import type { RouteObject } from "react-router-dom";
import { DisplayAuthUser } from "../../components/display-auth-user";

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
			<AppHeader>
				<DisplayAuthUser/>
			</AppHeader>
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

export const literatureGameRoute: RouteObject = {
	path: ":gameId",
	element: <GamePage/>,
	errorElement: <ErrorPage/>,
	loader: gameStoreLoader
};