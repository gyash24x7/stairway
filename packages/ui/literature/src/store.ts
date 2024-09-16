"use client";

import type { CardLocation, GameData, GameStatus, Move, Player, ScoreUpdate, TeamData } from "@literature/api";
import { CardHand, type IPlayingCard, PlayingCard } from "@stairway/cards";
import { produce } from "immer";
import { createContext, useContext } from "react";
import { createStore, StoreApi, useStore } from "zustand";

export type PlayerGameData = {
	playerId: string;
	gameData: GameData;
	hand: CardHand;
	cardLocations: CardLocation[];
}

export type GameEventHandlers = {
	handlePlayerJoinedEvent: ( data: Player ) => void;
	handleTeamsCreatedEvent: ( data: TeamData ) => void;
	handleMoveCreatedEvent: ( data: Move ) => void;
	handleTurnUpdatedEvent: ( data: string ) => void;
	handleScoreUpdatedEvent: ( data: ScoreUpdate ) => void;
	handleStatusUpdatedEvent: ( data: GameStatus ) => void;
	handleCardCountsUpdatedEvent: ( data: Record<string, number> ) => void;
	handleHandUpdatedEvent: ( data: IPlayingCard[] ) => void;
	handleCardLocationsUpdatedEvent: ( data: CardLocation[] ) => void;
	handleGameCompletedEvent: () => void;
}

export type RawGameData = Omit<PlayerGameData, "hand"> & { hand: IPlayingCard[] }

export type GameStore = {
	data: PlayerGameData;
	eventHandlers: GameEventHandlers;
}

export const createGameStore = ( gameData: RawGameData ) => createStore<GameStore>( set => ( {
	data: {
		...gameData,
		hand: CardHand.from( gameData.hand?.map( PlayingCard.from ) ?? [] )
	},
	eventHandlers: {
		handlePlayerJoinedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.gameData.players[ data.id ] = data;
				} )
			);
		},
		handleTeamsCreatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.gameData.teams = data;
					Object.values( data ).map( team => {
						team.memberIds.forEach( memberId => {
							state.data.gameData.players[ memberId ].teamId = team.id;
						} );
					} );
				} )
			);
		},
		handleMoveCreatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.gameData.moves = [ data, ...state.data.gameData.moves ];
				} )
			);
		},
		handleTurnUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.gameData.currentTurn = data;
				} )
			);
		},
		handleScoreUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.gameData.teams[ data.teamId ].score = data.score;
					state.data.gameData.teams[ data.teamId ].setsWon =
						[ data.setWon, ...state.data.gameData.teams[ data.teamId ].setsWon ];
				} )
			);
		},
		handleStatusUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.gameData.status = data;
				} )
			);
		},
		handleCardCountsUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.gameData.cardCounts = data;
				} )
			);
		},
		handleHandUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.hand = CardHand.from( data.map( PlayingCard.from ) );
				} )
			);
		},
		handleCardLocationsUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.cardLocations = data;
				} )
			);
		},
		handleGameCompletedEvent: () => {
			set(
				produce<GameStore>( state => {
					state.data.gameData.status = "COMPLETED";
				} )
			);
		}
	}
} ) );

export const GameStoreContext = createContext<StoreApi<GameStore> | undefined>( undefined );

export const useGameStore = <T>( selector: ( store: GameStore ) => T ) => {
	const gameStoreContext = useContext( GameStoreContext );
	if ( !gameStoreContext ) {
		throw new Error( "useGameStore to be used from inside the provider!" );
	}

	return useStore( gameStoreContext, selector );
};

export const useGameId = () => useGameStore( state => state.data.gameData.id );
export const usePlayerCount = () => useGameStore( state => state.data.gameData.playerCount );
export const useGameCode = () => useGameStore( state => state.data.gameData.code );
export const usePlayerId = () => useGameStore( state => state.data.playerId );
export const usePlayers = () => useGameStore( state => state.data.gameData.players );
export const useTeams = () => useGameStore( state => state.data.gameData.teams );
export const useGameStatus = () => useGameStore( state => state.data.gameData.status );
export const useCurrentTurn = () => useGameStore( state => state.data.gameData.currentTurn );
export const useHand = () => useGameStore( state => state.data.hand );
export const useLastMove = () => useGameStore( state => state.data.gameData.moves[ 0 ] );
export const useCardSetsInHand = () => useGameStore( state => state.data.hand.sets );
export const useCardCounts = () => useGameStore( state => state.data.gameData.cardCounts );
export const usePreviousMoves = () => useGameStore( state => state.data.gameData.moves.slice( 0, 5 ) );

export const useMyTeam = () => useGameStore( state => {
	const player = state.data.gameData.players[ state.data.playerId ];
	if ( !player.teamId ) {
		return null;
	}
	return state.data.gameData.teams[ player.teamId ];
} );

export const useOppositeTeam = () => useGameStore( state => {
	const player = state.data.gameData.players[ state.data.playerId ];
	if ( !player.teamId ) {
		return null;
	}
	return Object.values( state.data.gameData.teams ).find( team => team.id !== player.teamId );
} );

const GameEvents = {
	PLAYER_JOINED: "player-joined",
	TEAMS_CREATED: "teams-created",
	MOVE_CREATED: "move-created",
	TURN_UPDATED: "turn-updated",
	SCORE_UPDATED: "score-updated",
	STATUS_UPDATED: "status-updated",
	CARD_COUNT_UPDATED: "card-count-updated",
	GAME_COMPLETED: "game-completed"
};

const PlayerSpecificEvents = {
	HAND_UPDATED: "hand-updated",
	CARD_LOCATIONS_UPDATED: "card-locations-updated"
};

export const useGameEventHandlers = () => useGameStore( state => {
	return {
		[ GameEvents.PLAYER_JOINED ]: state.eventHandlers.handlePlayerJoinedEvent,
		[ GameEvents.TEAMS_CREATED ]: state.eventHandlers.handleTeamsCreatedEvent,
		[ GameEvents.MOVE_CREATED ]: state.eventHandlers.handleMoveCreatedEvent,
		[ GameEvents.TURN_UPDATED ]: state.eventHandlers.handleTurnUpdatedEvent,
		[ GameEvents.SCORE_UPDATED ]: state.eventHandlers.handleScoreUpdatedEvent,
		[ GameEvents.STATUS_UPDATED ]: state.eventHandlers.handleStatusUpdatedEvent,
		[ GameEvents.CARD_COUNT_UPDATED ]: state.eventHandlers.handleCardCountsUpdatedEvent,
		[ GameEvents.GAME_COMPLETED ]: state.eventHandlers.handleGameCompletedEvent
	};
} );

export const usePlayerSpecificEventHandlers = () => useGameStore( state => {
	return {
		[ PlayerSpecificEvents.HAND_UPDATED ]: state.eventHandlers.handleHandUpdatedEvent,
		[ PlayerSpecificEvents.CARD_LOCATIONS_UPDATED ]: state.eventHandlers.handleCardLocationsUpdatedEvent
	};
} );