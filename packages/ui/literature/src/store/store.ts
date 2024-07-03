import type { CardLocation, GameData, GameStatus, Move, Player, ScoreUpdate, TeamData } from "@backend/literature";
import { CardHand, type IPlayingCard, PlayingCard } from "@common/cards";
import { produce } from "immer";
import { create } from "zustand";

export type PlayerGameData = {
	playerId: string;
	gameData: GameData;
	hand: CardHand;
	cardLocations: CardLocation[];
}

export type GameStore = {
	data: PlayerGameData;
	eventHandlers: GameEventHandlers;
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

const initialPlayerGameData: PlayerGameData = {
	gameData: {
		id: "",
		code: "",
		playerCount: 0,
		players: {},
		teams: {},
		cardCounts: {},
		currentTurn: "",
		moves: [],
		status: "CREATED"
	},
	playerId: "",
	hand: CardHand.from( [] ),
	cardLocations: []
};

export const useLiteratureStore = create<GameStore>( set => ( {
	data: initialPlayerGameData,
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