"use client";

import {
	handleCardAskedEvent,
	handleCardCountsUpdatedEvent,
	handleCardsDealtEvent,
	handleGameCompletedEvent,
	handlePlayerJoinedEvent,
	handleScoreUpdatedEvent,
	handleSetCalledEvent,
	handleStatusUpdatedEvent,
	handleTeamsCreatedEvent,
	handleTurnTransferredEvent,
	handleTurnUpdatedEvent
} from "@/stores/literature";
import { LiteratureEvent } from "@/types/literature";
import { Fragment, type ReactNode, useEffect } from "react";
import { io } from "socket.io-client";

export function Subscriber( props: { gameId: string; playerId: string; children: ReactNode } ) {

	useEffect( () => {
		const socket = io( process.env.NODE_ENV === "production" ? "/_literature" : "localhost:8000/_literature" );

		socket.on( "connect", () => {
			console.log( "Connected to Literature Server!" );
			socket.emit( "join-game", { gameId: props.gameId, playerId: props.playerId } );
		} );

		socket.on( LiteratureEvent.PLAYER_JOINED, handlePlayerJoinedEvent );
		socket.on( LiteratureEvent.TEAMS_CREATED, handleTeamsCreatedEvent );
		socket.on( LiteratureEvent.CARD_ASKED, handleCardAskedEvent );
		socket.on( LiteratureEvent.CARDS_DEALT, handleCardsDealtEvent );
		socket.on( LiteratureEvent.SET_CALLED, handleSetCalledEvent );
		socket.on( LiteratureEvent.SCORE_UPDATED, handleScoreUpdatedEvent );
		socket.on( LiteratureEvent.STATUS_UPDATED, handleStatusUpdatedEvent );
		socket.on( LiteratureEvent.TURN_UPDATED, handleTurnUpdatedEvent );
		socket.on( LiteratureEvent.TURN_TRANSFERRED, handleTurnTransferredEvent );
		socket.on( LiteratureEvent.CARD_COUNT_UPDATED, handleCardCountsUpdatedEvent );
		socket.on( LiteratureEvent.GAME_COMPLETED, handleGameCompletedEvent );

		return () => {
			socket.close();
		};

	}, [ props.gameId, props.playerId ] );

	return <Fragment>{ props.children }</Fragment>;
}