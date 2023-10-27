import { Loader } from "@mantine/core";
import { LiveUpdatesProvider, useAction } from "@s2h/ui";
import { ReactNode, useEffect } from "react";
import { useParams } from "react-router-dom";
import { initializeGameStore, useGameStore } from "./store";
import { useAuthStore } from "@auth/ui";

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
	const playerId = useAuthStore( state => state.authInfo!.id );

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
		<LiveUpdatesProvider
			gameEvents={ gameEvents }
			playerEvents={ playerEvents }
			gameId={ props.gameId }
			playerId={ playerId }
		>
			{ props.children }
		</LiveUpdatesProvider>
	);
}

export function GameStoreProvider( props: { children: ReactNode } ) {
	const { gameId } = useParams();
	const { isLoading, error, execute } = useAction( initializeGameStore );

	useEffect( () => {
		execute( gameId! ).then();
	}, [] );

	if ( !!error ) {
		return <div>Some Error Happened!</div>;
	}

	if ( isLoading ) {
		return <Loader/>;
	}

	return <GameLiveUpdatesProvider gameId={ gameId! }>{ props.children }</GameLiveUpdatesProvider>;
}
