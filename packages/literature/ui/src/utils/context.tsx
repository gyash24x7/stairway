import { ReactNode, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader } from "@mantine/core";
import { LiveUpdatesProvider, useAction } from "@s2h/ui";
import { initializeGameStore, useGameStore } from "./store";

function GameLiveUpdatesProvider( props: { children: ReactNode, gameId: string } ) {
	const {
		handlePlayerJoinedEvent,
		handleTeamsCreatedEvent,
		handleMoveCreatedEvent,
		handleTurnUpdatedEvent,
		handleScoreUpdatedEvent,
		handleStatusUpdatedEvent,
		handleHandUpdatedEvent,
		handleInferencesUpdatedEvent,
		handleCardCountUpdatedEvent
	} = useGameStore( state => state.eventHandlers );

	const gameEvents = {
		PLAYER_JOINED: handlePlayerJoinedEvent,
		TEAMS_CREATED: handleTeamsCreatedEvent,
		MOVE_CREATED: handleMoveCreatedEvent,
		TURN_UPDATED: handleTurnUpdatedEvent,
		SCORE_UPDATED: handleScoreUpdatedEvent,
		STATUS_UPDATED: handleStatusUpdatedEvent,
		CARD_COUNT_UPDATED: handleCardCountUpdatedEvent
	};

	const playerEvents = {
		HAND_UPDATED: handleHandUpdatedEvent,
		INFERENCES_UPDATED: handleInferencesUpdatedEvent
	};

	return (
		<LiveUpdatesProvider gameEvents={ gameEvents } playerEvents={ playerEvents } room={ props.gameId }>
			{ props.children }
		</LiveUpdatesProvider>
	);
}

export function GameStoreProvider( props: { children: ReactNode } ) {
	const { gameId } = useParams();
	const { isLoading, error, data, execute } = useAction( initializeGameStore );

	useEffect( () => {
		execute( gameId! ).then();
	}, [] );

	if ( !!error ) {
		return <div>Some Error Happened!</div>;
	}

	if ( isLoading || !data ) {
		return <Loader/>;
	}

	return <GameLiveUpdatesProvider gameId={ gameId! }>{ props.children }</GameLiveUpdatesProvider>;
}
