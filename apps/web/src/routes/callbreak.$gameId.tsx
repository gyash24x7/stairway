import { callbreak } from "@stairway/clients/callbreak";
import { wssUrl } from "@stairway/clients/query.client";
import { GamePage } from "@callbreak/components";
import { useEventHandlers, useGameId, useGameStore, usePlayerId } from "@callbreak/store";
import type { Callbreak } from "@stairway/types/callbreak";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute( "/callbreak/$gameId" )( {
	beforeLoad: ( { context } ) => {
		if ( !context.authInfo ) {
			throw redirect( { to: "/" } );
		}
	},
	loader: async ( { params: { gameId }, context } ) => {
		const data = await context.queryClient.ensureQueryData( callbreak.getGameDataOptions( gameId ) );
		useGameStore.setState( { data } );
		return data;
	},
	component: () => {
		const gameId = useGameId();
		const playerId = usePlayerId();
		const eventHandlers = useEventHandlers();

		useEffect( () => {
			const websocket = new WebSocket( wssUrl );

			websocket.onopen = () => {
				websocket.send( JSON.stringify( { game: "callbreak", gameId, playerId } ) );
			};

			websocket.onmessage = ( msg ) => {
				const { event, data } = JSON.parse( msg.data ) as Callbreak.ClientEvents;

				switch ( event ) {
					case "player-joined":
						eventHandlers.handlePlayerJoinedEvent( data );
						break;

					case "all-players-joined":
						eventHandlers.handleAllPlayersJoinedEvent();
						break;

					case "deal-created":
						eventHandlers.handleDealCreatedEvent( data );
						break;

					case "cards-dealt":
						eventHandlers.handleCardsDealtEvent( data );
						break;

					case "deal-win-declared":
						eventHandlers.handleDealWinDeclaredEvent( data );
						break;

					case "all-deal-wins-declared":
						eventHandlers.handleAllDealWinsDeclaredEvent();
						break;

					case "round-created":
						eventHandlers.handleRoundCreatedEvent( data );
						break;

					case "card-played":
						eventHandlers.handleCardPlayedEvent( data );
						break;

					case "round-completed":
						eventHandlers.handleRoundCompletedEvent( data );
						break;

					case "deal-completed":
						eventHandlers.handleDealCompletedEvent( data );
						break;

					case "status-updated":
						eventHandlers.handleStatusUpdatedEvent( data );
						break;

					case "game-completed":
						eventHandlers.handleGameCompletedEvent();
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
