import type {
	CardInferences,
	GameData,
	Move,
	Player,
	PlayerSpecificData,
	ScoreUpdate,
	TeamData
} from "@literature/types";
import { GameStatus } from "@literature/types";
import type { PlayingCard } from "@s2h/cards";
import { produce } from "immer";
import { create } from "zustand";

export type GameState = {
	gameData: GameData;
	playerData: PlayerSpecificData;
}

export type GameEventHandlers = {
	handlePlayerJoinedEvent: ( data: Player ) => void;
	handleTeamsCreatedEvent: ( data: TeamData ) => void;
	handleMoveCreatedEvent: ( data: Move ) => void;
	handleTurnUpdatedEvent: ( data: string ) => void;
	handleScoreUpdatedEvent: ( data: ScoreUpdate ) => void;
	handleStatusUpdatedEvent: ( data: GameStatus ) => void;
	handleCardCountsUpdatedEvent: ( data: Record<string, number> ) => void;
	handleHandUpdatedEvent: ( data: PlayingCard[] ) => void;
	handleInferencesUpdatedEvent: ( data: CardInferences ) => void;
}

export type GameStore = GameState & GameEventHandlers;

const defaultGameData: GameData = {
	id: "",
	players: {},
	teams: {},
	moves: [],
	currentTurn: "",
	status: GameStatus.CREATED,
	cardCounts: {},
	code: "",
	playerCount: 2
};

const defaultPlayerData: PlayerSpecificData = {
	id: "",
	name: "",
	avatar: "",
	isBot: false,
	teamId: "",
	oppositeTeamId: "",
	hand: [],
	inferences: {},
	cardSets: []
};

export const useGameStore = create<GameStore>( ( set ) => {
	return {
		gameData: defaultGameData,
		playerData: defaultPlayerData,
		handlePlayerJoinedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.gameData.players[ data.id ] = data;
				} )
			);
		},
		handleTeamsCreatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.gameData.teams = data;
				} )
			);
		},
		handleMoveCreatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.gameData.moves = [ data, ...state.gameData.moves ];
				} )
			);
		},
		handleTurnUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.gameData.currentTurn = data;
				} )
			);
		},
		handleScoreUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.gameData.teams[ data.teamId ].score = data.score;
					state.gameData.teams[ data.teamId ].setsWon =
						[ data.setWon, ...state.gameData.teams[ data.teamId ].setsWon ];
				} )
			);
		},
		handleStatusUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.gameData.status = data;
				} )
			);
		},
		handleCardCountsUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.gameData.cardCounts = data;
				} )
			);
		},
		handleHandUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.playerData.hand = data;
				} )
			);
		},
		handleInferencesUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.playerData.inferences = data;
				} )
			);
		}
	};
} );