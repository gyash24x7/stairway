"use client";

import { getCardFromId } from "@stairway/cards";
import { cn, Spinner } from "@stairway/components/base";
import { DisplayCard, DisplayHand, DisplayPlayer, GameCode } from "@stairway/components/main";
import {
	callbreak$,
	type PlayerGameData,
	useCurrentDeal,
	useCurrentRound,
	useGameCode,
	useGameStatus,
	useHand,
	usePlayers
} from "@stairway/stores/callbreak";
import { Fragment, useEffect, useState } from "react";
import useWebSocket from "react-use-websocket";
import { ActionPanel } from "./action-panel.tsx";
import { DisplayScore } from "./display-score.tsx";
import { GameCompleted } from "./game-completed.tsx";
import { PlayerLobby } from "./player-lobby.tsx";

const WSS_URL = process.env[ "WSS_URL" ] ?? "ws://localhost:8000";

export function GamePage( props: { gameData: PlayerGameData } ) {
	const [ isLoading, setIsLoading ] = useState( true );
	const players = usePlayers();
	const status = useGameStatus();
	const code = useGameCode();
	const hand = useHand();
	const deal = useCurrentDeal();
	const round = useCurrentRound();

	const playerOrder = round?.playerOrder ?? deal?.playerOrder ?? Object.keys( players );

	const { sendJsonMessage } = useWebSocket( WSS_URL, {
		onOpen() {
			console.log( "Callbreak engine connected!" );
			sendJsonMessage( {
				gameId: props.gameData.game.id,
				type: "callbreak",
				playerId: props.gameData.playerId
			} );
		},
		onMessage( message ) {
			const { type, data } = JSON.parse( message.data );
			console.log( "Received event: ", type );

			switch ( type ) {
				case "player-joined":
					console.log( "Received player-joined event", data );
					callbreak$.eventHandlers.handlePlayerJoinedEvent( data );
					break;

				case "status-updated":
					console.log( "Received status-updated event", data );
					callbreak$.eventHandlers.handleStatusUpdatedEvent( data );
					break;

				case "all-players-joined":
					console.log( "Received all-players-joined event" );
					callbreak$.eventHandlers.handleAllPlayersJoinedEvent();
					break;

				case "deal-created":
					console.log( "Received deal-created event", data );
					callbreak$.eventHandlers.handleDealCreatedEvent( data );
					break;

				case "all-deal-wins-declared":
					console.log( "Received all-deal-wins-declared event" );
					callbreak$.eventHandlers.handleAllDealWinsDeclaredEvent();
					break;

				case "deal-win-declared":
					console.log( "Received deal-win-declared event", data );
					callbreak$.eventHandlers.handleDealWinDeclaredEvent( data );
					break;

				case "round-created":
					console.log( "Received round-created event", data );
					callbreak$.eventHandlers.handleRoundCreatedEvent( data );
					break;

				case "card-played":
					console.log( "Received card-played event", data );
					callbreak$.eventHandlers.handleCardPlayedEvent( data );
					break;

				case "round-completed":
					console.log( "Received round-completed event", data );
					callbreak$.eventHandlers.handleRoundCompletedEvent( data );
					break;

				case "deal-completed":
					console.log( "Received deal-completed event", data );
					callbreak$.eventHandlers.handleDealCompletedEvent( data );
					break;

				case "game-completed":
					console.log( "Received game-completed event", data );
					callbreak$.eventHandlers.handleGameCompletedEvent();
					break;

				case `cards-dealt`:
					console.log( "Received cards-dealt event", data );
					callbreak$.eventHandlers.handleCardsDealtEvent( data );
					break;
			}
		}
	} );

	useEffect( () => {
		if ( props.gameData ) {
			callbreak$.data.set( props.gameData );
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
						{ deal?.status !== "IN_PROGRESS" && <PlayerLobby withBg/> }
						<DisplayScore/>
						{ status === "IN_PROGRESS" && deal?.status === "IN_PROGRESS" && (
							<div
								className={ "rounded-md p-3 border-2 relative min-h-80 flex items-center justify-center" }>
								{ Object.keys( players ).map( ( player, i ) => (
									<div
										key={ player }
										className={ cn(
											"absolute h-1/3 w-1/3 max-w-md flex justify-center items-center bg-muted p-2",
											i === 0 && "top-0 left-0",
											i === 1 && "top-0 right-0",
											i === 2 && "bottom-0 right-0",
											i === 3 && "bottom-0 left-0",
											deal?.playerOrder[ deal.turnIdx ] === player && "border-2 border-primary",
											round?.playerOrder[ round.turnIdx ] === player && "border-2 border-primary"
										) }
									>
										<DisplayPlayer player={ players[ player ]! }/>
									</div>
								) ) }
								{ !!round && (
									<div className={ "grid gap-2 py-2 grid-cols-2 lg:grid-cols-4" }>
										{ playerOrder.map( player => {
											if ( !round.cards[ player ] ) {
												return;
											}

											const cardId = round.cards[ player ]!;
											const card = getCardFromId( cardId );
											return (
												<div className={ "flex w-full justify-center" } key={ player }>
													<DisplayCard rank={ card.rank } suit={ card.suit } key={ cardId }/>
												</div>
											);
										} ) }
									</div>
								) }
							</div>
						) }
						{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
						{ status === "COMPLETED" && <GameCompleted/> }
					</div>
					{ status !== "COMPLETED" && <ActionPanel/> }
				</Fragment>
			) }
		</div>
	);
}