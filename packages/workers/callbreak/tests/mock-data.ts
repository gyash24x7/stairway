import type { Deal, Player } from "../src/types.ts";

export const mockPlayer1: Player = {
	id: "p1",
	name: "Test Player 1",
	username: "player1",
	avatar: "",
	isBot: false
};

export const mockPlayer2: Player = {
	id: "p2",
	name: "Test Player 2",
	username: "player2",
	avatar: "",
	isBot: true
};

export const mockPlayer3: Player = {
	id: "p3",
	name: "Test Player 3",
	username: "player3",
	avatar: "",
	isBot: true
};

export const mockPlayer4: Player = {
	id: "p4",
	name: "Test Player 4",
	username: "player4",
	avatar: "",
	isBot: true
};

export const mockDeal: Deal = {
	createdAt: 0,
	declarations: {},
	hands: {},
	playerOrder: [],
	status: "CREATED",
	wins: {},
	id: "deal-1"
};