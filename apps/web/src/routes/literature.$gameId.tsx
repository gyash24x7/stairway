import { literature } from "@stairway/clients/literature";
import { wssUrl } from "@stairway/clients/query.client";
import { GamePage } from "@literature/components";
import { useEventHandlers, useGameId, useGameStore, usePlayerId } from "@literature/store";
import type { Literature } from "@stairway/types/literature";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute( "/literature/$gameId" )( {
	beforeLoad: ( { context } ) => {
		if ( !context.authInfo ) {
			throw redirect( { to: "/" } );
		}
	},
	loader: async ( { params: { gameId }, context } ) => {
		const data = await context.queryClient.ensureQueryData( literature.getGameDataOptions( gameId ) );
		useGameStore.setState( { data } );
		return data;
	},
	component: () => {
		const playerId = usePlayerId();
		const gameId = useGameId();
		const eventHandlers = useEventHandlers();

		useEffect( () => {
			const websocket = new WebSocket( wssUrl );

			websocket.onopen = () => {
				websocket.send( JSON.stringify( { game: "literature", gameId, playerId } ) );
			};

			websocket.onmessage = ( msg ) => {
				const { event, data } = JSON.parse( msg.data ) as Literature.ClientEvents;

				switch ( event ) {
					case "player-joined":
						eventHandlers.handlePlayerJoinedEvent( data );
						break;

					case "teams-created":
						eventHandlers.handleTeamsCreatedEvent( data );
						break;

					case "card-asked":
						eventHandlers.handleCardAskedEvent( data );
						break;

					case "card-count-updated":
						eventHandlers.handleCardCountsUpdatedEvent( data );
						break;

					case "cards-dealt":
						eventHandlers.handleCardsDealtEvent( data );
						break;

					case "game-completed":
						eventHandlers.handleGameCompletedEvent( data );
						break;

					case "score-updated":
						eventHandlers.handleScoreUpdatedEvent( data );
						break;

					case "set-called":
						eventHandlers.handleSetCalledEvent( data );
						break;

					case "status-updated":
						eventHandlers.handleStatusUpdatedEvent( data );
						break;

					case "turn-transferred":
						eventHandlers.handleTurnTransferredEvent( data );
						break;

					case "turn-updated":
						eventHandlers.handleTurnUpdatedEvent( data );
						break;
				}
			};

			return () => {
				websocket.close();
			};
		}, [] );

		return <GamePage/>;
	}
} );
