import { observable } from "@legendapp/state";
import type {
	Ask,
	Call,
	CardCounts,
	Game,
	GameStatus,
	Metrics,
	Player,
	PlayerData,
	ScoreUpdate,
	TeamData,
	Transfer
} from "@stairway/api/literature";
import {
	addCardToHand,
	getCardFromId,
	type PlayingCard,
	removeCardFromHand,
	removeCardsFromHand
} from "@stairway/cards";

export type PlayerGameData = {
	playerId: string;
	game: Game;
	players: PlayerData;
	teams: TeamData;
	cardCounts: CardCounts;
	hand: PlayingCard[];
	lastMoveData?: { move?: Ask | Transfer, isCall: false } | { move: Call, isCall: true };
	asks: Ask[];
	metrics: Metrics
}

export type GameEventHandlers = {
	handlePlayerJoinedEvent: ( newPlayer: Player ) => void;
	handleTeamsCreatedEvent: ( teams: TeamData ) => void;
	handleCardAskedEvent: ( ask: Ask ) => void;
	handleSetCalledEvent: ( call: Call ) => void;
	handleTurnTransferredEvent: ( transfer: Transfer ) => void;
	handleTurnUpdatedEvent: ( nextTurn: string ) => void;
	handleScoreUpdatedEvent: ( scoreUpdate: ScoreUpdate ) => void;
	handleStatusUpdatedEvent: ( status: GameStatus ) => void;
	handleCardCountsUpdatedEvent: ( cardCounts: CardCounts ) => void;
	handleGameCompletedEvent: ( metrics: Metrics ) => void;
	handleCardsDealtEvent: ( cards: PlayingCard[] ) => void;
}

export type GameStore = {
	data: PlayerGameData;
	eventHandlers: GameEventHandlers;
}

export const literature$ = observable<GameStore>( {
	data: {
		playerId: "",
		game: {
			id: "",
			code: "",
			status: "CREATED",
			playerCount: 0,
			currentTurn: "",
			lastMoveId: ""
		},
		players: {},
		teams: {},
		cardCounts: {},
		hand: [],
		asks: [],
		metrics: { player: [], team: [] }
	},
	eventHandlers: {
		handlePlayerJoinedEvent: ( newPlayer ) => {
			literature$.data.players.set( { ...literature$.data.players.get(), [ newPlayer.id ]: newPlayer } );
		},
		handleTeamsCreatedEvent: ( teams ) => {
			const players = literature$.data.players.get();
			Object.values( teams ).map( team => {
				team.memberIds.map( playerId => {
					if ( players[ playerId ] ) {
						players[ playerId ].teamId = team.id;
					}
				} );
			} );

			literature$.data.players.set( players );
			literature$.data.teams.set( teams );
		},
		handleCardAskedEvent: ( ask ) => {
			literature$.data.asks.unshift( ask );
			literature$.data.game.lastMoveId.set( ask.id );
			literature$.data.lastMoveData.set( { move: ask, isCall: false } );

			const askedCard = getCardFromId( ask.cardId );
			const playerId = literature$.data.playerId.get();
			if ( ask.playerId === playerId && ask.success ) {
				literature$.data.hand.set( addCardToHand( literature$.data.hand.get(), askedCard ) );
			}

			if ( ask.askedFrom === playerId && ask.success ) {
				literature$.data.hand.set( removeCardFromHand( literature$.data.hand.get(), askedCard ) );
			}
		},
		handleSetCalledEvent: ( call ) => {
			literature$.data.game.lastMoveId.set( call.id );
			literature$.data.lastMoveData.set( { move: call, isCall: true } );
			literature$.data.hand.set( removeCardsFromHand(
				literature$.data.hand.get(),
				Object.keys( call.correctCall ).map( getCardFromId )
			) );
		},
		handleTurnTransferredEvent: ( transfer ) => {
			literature$.data.game.lastMoveId.set( transfer.id );
			literature$.data.lastMoveData.set( { move: transfer, isCall: false } );
		},
		handleTurnUpdatedEvent: ( nextTurn ) => {
			literature$.data.game.currentTurn.set( nextTurn );
		},
		handleScoreUpdatedEvent: ( { teamId, score, setWon } ) => {
			const teams = literature$.data.teams.get();
			teams[ teamId ].score = score;
			teams[ teamId ].setsWon.push( setWon );
			literature$.data.teams.set( teams );
		},
		handleStatusUpdatedEvent: ( status ) => {
			literature$.data.game.status.set( status );
		},
		handleCardCountsUpdatedEvent: ( cardCounts ) => {
			literature$.data.cardCounts.set( cardCounts );
		},
		handleGameCompletedEvent: ( metrics ) => {
			literature$.data.metrics.set( metrics );
			literature$.data.game.status.set( "COMPLETED" );
		},
		handleCardsDealtEvent: ( cards ) => {
			literature$.data.hand.set( cards );
		}
	}
} );