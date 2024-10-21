"use client";

import { observer } from "@legendapp/state/react";
import { Spinner } from "@stairway/components/base";
import { DisplayHand, GameCode } from "@stairway/components/main";
import {
	literature$,
	type PlayerGameData,
	useGameCode,
	useGameStatus,
	useHand,
	useLastMove
} from "@stairway/stores/literature";
import { Fragment, useEffect, useMemo, useState } from "react";
import useWebSocket from "react-use-websocket";
import { ActionPanel } from "./action-panel.tsx";
import { DisplayTeams } from "./display-teams.tsx";
import { GameCompleted } from "./game-completed.tsx";
import { PlayerLobby } from "./player-lobby.tsx";

const WSS_DOMAIN = process.env[ "NEXT_PUBLIC_WSS_DOMAIN" ] ?? "localhost:8000";
const WSS_PROTOCOL = process.env[ "NODE_ENV" ] === "production" ? "wss" : "ws";
const WSS_URL = `${ WSS_PROTOCOL }://${ WSS_DOMAIN }`;

export const GamePage = observer( ( props: { gameData: PlayerGameData } ) => {
	const [ isLoading, setIsLoading ] = useState( true );
	const status = useGameStatus();
	const lastMove = useLastMove();
	const code = useGameCode();
	const hand = useHand();

	const { sendJsonMessage } = useWebSocket( WSS_URL, {
		onOpen() {
			console.log( "Literature engine connected!" );
			sendJsonMessage( {
				gameId: props.gameData.game.id,
				type: "literature",
				playerId: props.gameData.playerId
			} );
		},
		onMessage( message ) {
			const { type, data } = JSON.parse( message.data );
			console.log( "Received event: ", type );

			switch ( type ) {
				case "player-joined":
					console.log( "Received player-joined event", data );
					literature$.eventHandlers.handlePlayerJoinedEvent( data );
					break;

				case "teams-created":
					console.log( "Received teams-created event", data );
					literature$.eventHandlers.handleTeamsCreatedEvent( data );
					break;

				case "card-asked":
					console.log( "Received card-asked event", data );
					literature$.eventHandlers.handleCardAskedEvent( data );
					break;

				case "set-called":
					console.log( "Received set-called event", data );
					literature$.eventHandlers.handleSetCalledEvent( data );
					break;

				case "turn-transferred":
					console.log( "Received turn-transferred event", data );
					literature$.eventHandlers.handleTurnTransferredEvent( data );
					break;

				case "turn-updated":
					console.log( "Received turn-updated event", data );
					literature$.eventHandlers.handleTurnUpdatedEvent( data );
					break;

				case "score-updated":
					console.log( "Received score-updated event", data );
					literature$.eventHandlers.handleScoreUpdatedEvent( data );
					break;

				case "status-updated":
					console.log( "Received status-updated event", data );
					literature$.eventHandlers.handleStatusUpdatedEvent( data );
					break;

				case "card-count-updated":
					console.log( "Received card-counts-updated event", data );
					literature$.eventHandlers.handleCardCountsUpdatedEvent( data );
					break;

				case "game-completed":
					console.log( "Received game-completed event", data );
					literature$.eventHandlers.handleGameCompletedEvent( data );
					break;

				case "cards-dealt":
					console.log( "Received cards-dealt event", data );
					literature$.eventHandlers.handleCardsDealtEvent( data );
					break;
			}
		}
	} );

	const areTeamsCreated = useMemo(
		() => status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED",
		[ status ]
	);

	useEffect( () => {
		if ( props.gameData ) {
			literature$.data.set( props.gameData );
			setIsLoading( false );
		}
	}, [] );

	return (
		<div className={ `flex flex-col gap-3` }>
			{ isLoading && <Spinner/> }
			{ !isLoading && (
				<Fragment>
					<GameCode code={ code }/>
					<div className={ "flex flex-col gap-3 justify-between mb-52" }>
						{ areTeamsCreated && <DisplayTeams/> }
						{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
						{ status === "IN_PROGRESS" && !!lastMove && (
							<div className={ "p-3 border-2 rounded-md" }>
								<p>{ lastMove.description }</p>
							</div>
						) }
						<PlayerLobby withBg withCardCount={ status === "IN_PROGRESS" }/>
						{ status === "COMPLETED" && <GameCompleted/> }
					</div>
					{ status !== "COMPLETED" && <ActionPanel/> }
				</Fragment>
			) }
		</div>
	);
} );