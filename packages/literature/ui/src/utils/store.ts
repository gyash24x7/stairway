import type {
	CardInferences,
	GameData,
	GameStatus,
	Move,
	Player,
	PlayerSpecificData,
	ScoreUpdate,
	TeamWithMembers
} from "@literature/types";
import { create } from "zustand";
import { loadGameData, loadPlayerData } from "./client";
import type { PlayingCard } from "@s2h/cards";

export type EventHandlers = {
	handlePlayerJoinedEvent: ( player: Player ) => void;
	handleTeamsCreatedEvent: ( teams: Record<string, TeamWithMembers> ) => void;
	handleMoveCreatedEvent: ( move: Move ) => void;
	handleTurnUpdatedEvent: ( turn: string ) => void;
	handleScoreUpdatedEvent: ( scoreUpdate: ScoreUpdate ) => void;
	handleStatusUpdatedEvent: ( status: GameStatus ) => void;
	handleCardCountUpdatedEvent: ( cardCounts: Record<string, number> ) => void;
	handleHandUpdatedEvent: ( hand: PlayingCard[] ) => void;
	handleInferencesUpdatedEvent: ( inferences: CardInferences ) => void;
}

export type GameStore = {
	gameData?: GameData;
	playerData?: PlayerSpecificData,
	eventHandlers: EventHandlers;
}

export async function initializeGameStore( gameId: string ) {
	const gameData = await loadGameData( { gameId } );
	const playerData = await loadPlayerData( { gameId } );
	useGameStore.setState( state => {
		return { ...state, gameData, playerData };
	} );
}

export const useGameStore = create<GameStore>( set => {
	return {
		eventHandlers: {
			handleMoveCreatedEvent( move: Move ) {
				set( state => {
					state.gameData!.moves = [ move, ...state.gameData!.moves ];
					return state;
				} );
			},
			handlePlayerJoinedEvent( player: Player ) {
				set( state => {
					state.gameData!.players[ player.id ] = player;
					return state;
				} );
			},
			handleScoreUpdatedEvent( data: ScoreUpdate ) {
				set( state => {
					state.gameData!.teams[ data.teamId ].score = data.score;
					state.gameData!.teams[ data.teamId ].setsWon.push( data.setWon );
					return state;
				} );
			},
			handleStatusUpdatedEvent( status: GameStatus ) {
				set( state => {
					state.gameData!.status = status;
					return state;
				} );
			},
			handleTeamsCreatedEvent( teams: Record<string, TeamWithMembers> ) {
				set( state => {
					Object.values( teams ).map( team => {
						state.gameData!.teams[ team.id ] = team;
						team.members.map( memberId => {
							state.gameData!.players[ memberId ].teamId = team.id;
						} );
					} );

					return state;
				} );
			},
			handleTurnUpdatedEvent( turn: string ) {
				set( state => {
					state.gameData!.currentTurn = turn;
					return state;
				} );
			},
			handleCardCountUpdatedEvent( cardCounts: Record<string, number> ) {
				set( state => {
					state.gameData!.cardCounts = cardCounts;
					return state;
				} );
			},
			handleHandUpdatedEvent( hand: PlayingCard[] ) {
				set( state => {
					state.playerData!.hand = hand;
					return state;
				} );
			},
			handleInferencesUpdatedEvent( inferences: CardInferences ) {
				set( state => {
					state.playerData!.inferences = inferences;
					return state;
				} );
			}
		}
	};
} );