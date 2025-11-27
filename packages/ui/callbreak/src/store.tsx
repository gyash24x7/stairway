"use client";

import type { PlayerGameInfo } from "@s2h/callbreak/types";
import { Store } from "@tanstack/react-store";

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
