import type { BookState, FishBook, FishPlayerGameInfo } from "@/libs/fish/types";
import { Store } from "@tanstack/react-store";

export const store = new Store<FishPlayerGameInfo>( {
	bookStates: {} as Record<FishBook, BookState>,
	cardCounts: {},
	claimHistory: [],
	config: {
		playerCount: 6,
		teamCount: 2,
		type: "NORMAL",
		books: [],
		deckType: 48
	},
	playerIds: [],
	teamIds: [],
	transferHistory: [],
	playerId: "",
	id: "",
	code: "",
	status: "CREATED",
	currentTurn: "",
	players: {},
	teams: {},
	hand: [],
	askHistory: []
} );
