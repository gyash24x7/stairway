"use client";

import {
	handleAllDealWinsDeclaredEvent,
	handleAllPlayersJoinedEvent,
	handleCardPlayedEvent,
	handleCardsDealtEvent,
	handleDealCompletedEvent,
	handleDealCreatedEvent,
	handleDealWinDeclaredEvent,
	handleGameCompletedEvent,
	handlePlayerJoinedEvent,
	handleRoundCompletedEvent,
	handleRoundCreatedEvent
} from "@/stores/callbreak";
import { CallbreakEvent } from "@/types/callbreak";
import { Fragment, type ReactNode, useEffect } from "react";
import { io } from "socket.io-client";

export function Subscriber( props: { gameId: string; playerId: string; children: ReactNode } ) {

	useEffect( () => {
		const socket = io( process.env.NODE_ENV === "production" ? "/_callbreak" : "localhost:8000/_callbreak" );

		socket.on( "connect", () => {
			console.log( "Connected to Callbreak Server!" );
			socket.emit( "join-game", { gameId: props.gameId, playerId: props.playerId } );
		} );

		socket.on( CallbreakEvent.PLAYER_JOINED, handlePlayerJoinedEvent );
		socket.on( CallbreakEvent.ALL_PLAYERS_JOINED, handleAllPlayersJoinedEvent );
		socket.on( CallbreakEvent.DEAL_CREATED, handleDealCreatedEvent );
		socket.on( CallbreakEvent.CARDS_DEALT, handleCardsDealtEvent );
		socket.on( CallbreakEvent.DEAL_WIN_DECLARED, handleDealWinDeclaredEvent );
		socket.on( CallbreakEvent.ALL_DEAL_WINS_DECLARED, handleAllDealWinsDeclaredEvent );
		socket.on( CallbreakEvent.ROUND_CREATED, handleRoundCreatedEvent );
		socket.on( CallbreakEvent.CARD_PLAYED, handleCardPlayedEvent );
		socket.on( CallbreakEvent.ROUND_COMPLETED, handleRoundCompletedEvent );
		socket.on( CallbreakEvent.DEAL_COMPLETED, handleDealCompletedEvent );
		socket.on( CallbreakEvent.GAME_COMPLETED, handleGameCompletedEvent );

		return () => {
			socket.close();
		};

	}, [ props.gameId, props.playerId ] );

	return <Fragment>{ props.children }</Fragment>;
}