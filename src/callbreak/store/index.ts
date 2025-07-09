import type { Callbreak } from "@/callbreak/types";
import { Store } from "@tanstack/react-store";

export const store = new Store<Callbreak.Store>( {
	playerId: "",
	game: {
		id: "",
		status: "CREATED",
		code: "",
		dealCount: 0,
		trump: "D",
		createdBy: "",
		currentTurn: "",
		scores: {}
	},
	players: {},
	hand: []
} );
