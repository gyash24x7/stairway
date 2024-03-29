import type { PlayingCard } from "@common/cards";
import { getCardSetsInHand } from "@common/cards";
import type { GameData, GameStatus, Move, Player, PlayerSpecificData, ScoreUpdate, TeamData } from "@literature/data";
import { produce } from "immer";
import { create } from "zustand";

export type GameState = {
	gameData: GameData;
	playerSpecificData: PlayerSpecificData;
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
}

export type GameStore = GameState & GameEventHandlers;

const defaultGameData: GameData = {
	id: "",
	players: {},
	teams: {},
	moves: [],
	currentTurn: "",
	status: "CREATED",
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
	cardSets: []
};

export const useGameStore = create<GameStore>( ( set ) => {
	return {
		gameData: defaultGameData,
		playerSpecificData: defaultPlayerData,
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
					Object.values( data ).map( team => {
						if ( team.memberIds.includes( state.playerSpecificData.id ) ) {
							state.playerSpecificData.teamId = team.id;
						} else {
							state.playerSpecificData.oppositeTeamId = team.id;
						}
						team.memberIds.forEach( memberId => {
							state.gameData.players[ memberId ].teamId = team.id;
						} );
					} );
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
					state.playerSpecificData.hand = data;
					state.playerSpecificData.cardSets = getCardSetsInHand( data );
				} )
			);
		}
	};
} );