"use client";

import type { PlayerGameInfo } from "@/core/callbreak/schema";
import { Store } from "@tanstack/react-store";
import { Fragment, type ReactNode, useEffect } from "react";

export const store = new Store<PlayerGameInfo>( {
	playerId: "",
	id: "",
	status: "GAME_CREATED",
	code: "",
	dealCount: 0,
	trump: "D",
	createdBy: "",
	currentTurn: "",
	scores: {},
	players: {},
	hand: []
} );

export function StoreLoader( props: { children: ReactNode; data: PlayerGameInfo } ) {
	useEffect( () => {
		store.setState( props.data );
	}, [ props.data ] );

	return <Fragment>{ props.children }</Fragment>;
}