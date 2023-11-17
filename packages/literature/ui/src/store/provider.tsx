import { initializeSocketForNamespace, subscribeToEvents } from "@s2h/ui";
import type { ReactNode } from "react";
import { Fragment, useEffect } from "react";
import { useGameEventHandlers, useGameId, usePlayerId, usePlayerSpecificEventHandlers } from "./hooks";

export function GameProvider( props: { children: ReactNode } ) {
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

	return <Fragment>{ props.children }</Fragment>;
}