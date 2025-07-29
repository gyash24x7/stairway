import type { CardId } from "@/libs/cards/types";

export const NORMAL_FISH_BOOKS = {
	"ACES": [ "AC", "AD", "AH", "AS" ] as CardId[],
	"TWOS": [ "2C", "2D", "2H", "2S" ] as CardId[],
	"THREES": [ "3C", "3D", "3H", "3S" ] as CardId[],
	"FOURS": [ "4C", "4D", "4H", "4S" ] as CardId[],
	"FIVES": [ "5C", "5D", "5H", "5S" ] as CardId[],
	"SIXES": [ "6C", "6D", "6H", "6S" ] as CardId[],
	"SEVENS": [ "7C", "7D", "7H", "7S" ] as CardId[],
	"EIGHTS": [ "8C", "8D", "8H", "8S" ] as CardId[],
	"NINES": [ "9C", "9D", "9H", "9S" ] as CardId[],
	"TENS": [ "10C", "10D", "10H", "10S" ] as CardId[],
	"JACKS": [ "JC", "JD", "JH", "JS" ] as CardId[],
	"QUEENS": [ "QC", "QD", "QH", "QS" ] as CardId[],
	"KINGS": [ "KC", "KD", "KH", "KS" ] as CardId[]
} as const;

export const CANADIAN_FISH_BOOKS = {
	"LC": [ "AC", "2C", "3C", "4C", "5C", "6C" ] as CardId[],
	"LD": [ "AD", "2D", "3D", "4D", "5D", "6D" ] as CardId[],
	"UC": [ "8C", "9C", "10C", "JC", "QC", "KC" ] as CardId[],
	"UD": [ "8D", "9D", "10D", "JD", "QD", "KD" ] as CardId[],
	"LH": [ "AH", "2H", "3H", "4H", "5H", "6H" ] as CardId[],
	"UH": [ "8H", "9H", "10H", "JH", "QH", "KH" ] as CardId[],
	"LS": [ "AS", "2S", "3S", "4S", "5S", "6S" ] as CardId[],
	"US": [ "8S", "9S", "10S", "JS", "QS", "KS" ] as CardId[]
} as const;

export const GAME_STATUS = {
	CREATED: "CREATED",
	PLAYERS_READY: "PLAYERS_READY",
	TEAMS_CREATED: "TEAMS_CREATED",
	IN_PROGRESS: "IN_PROGRESS",
	COMPLETED: "COMPLETED"
} as const;