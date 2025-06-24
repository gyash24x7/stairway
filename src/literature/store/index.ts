import type { Literature } from "@/literature/types";
import { Store } from "@tanstack/react-store";

export const store = new Store<Literature.Store>( {
	playerId: "",
	game: {
		id: "",
		code: "",
		status: "CREATED",
		playerCount: 0,
		currentTurn: ""
	},
	players: {},
	teams: {},
	hand: [],
	asks: []
} );
