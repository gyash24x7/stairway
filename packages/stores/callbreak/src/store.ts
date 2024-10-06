import type { Deal, DealWithRounds, Game, Player, PlayerData, Round, Status } from "@callbreak/api";
import { CardHand, type IPlayingCard, PlayingCard } from "@stairway/cards";
import { produce } from "immer";
import { toast } from "sonner";
import { create } from "zustand";

export type PlayerGameData = {
	playerId: string;
	game: Game;
	players: PlayerData;
	deals: DealWithRounds[];
	hand: CardHand;
}

export type GameEventHandlers = {
	handlePlayerJoinedEvent: ( newPlayer: Player ) => void;
	handleAllPlayersJoinedEvent: () => void;
	handleDealCreatedEvent: ( deal: Deal ) => void;
	handleDealWinDeclaredEvent: ( data: { deal: Deal, by: Player, wins: number } ) => void;
	handleAllDealWinsDeclaredEvent: () => void;
	handleRoundCreatedEvent: ( round: Round ) => void;
	handleCardPlayedEvent: ( data: { round: Round, by: string, card: string } ) => void;
	handleRoundCompletedEvent: ( data: { round: Round; deal: DealWithRounds, winner: Player } ) => void;
	handleDealCompletedEvent: ( data: { deal: DealWithRounds, score: Record<string, number> } ) => void;
	handleStatusUpdatedEvent: ( status: Status ) => void;
	handleGameCompletedEvent: () => void;
	handleCardsDealtEvent: ( cards: IPlayingCard[] ) => void;
}

export type GameStore = {
	data: PlayerGameData;
	eventHandlers: GameEventHandlers;
}

export const useGameStore = create<GameStore>( set => ( {
	data: {
		playerId: "",
		game: {
			id: "",
			status: "CREATED",
			code: "",
			dealCount: 0,
			trumpSuit: "",
			createdBy: "",
			scores: []
		},
		players: {},
		deals: [],
		hand: CardHand.empty()
	},
	eventHandlers: {
		handlePlayerJoinedEvent: ( newPlayer ) => {
			set(
				produce<GameStore>( state => {
					state.data.players[ newPlayer.id ] = newPlayer;
				} )
			);

			toast.success( `${ newPlayer.name } joined the game!` );
		},
		handleAllPlayersJoinedEvent: () => {
			set(
				produce<GameStore>( state => {
					state.data.game.status = "IN_PROGRESS";
				} )
			);
			toast.info( "All players have joined the game. Starting round..." );
		},
		handleDealCreatedEvent: ( deal ) => {
			set(
				produce<GameStore>( state => {
					state.data.deals = [ { ...deal, rounds: [] }, ...state.data.deals ];
				} )
			);

			toast.info( "Deal created. Waiting for all players to declare wins..." );
		},
		handleAllDealWinsDeclaredEvent: () => {
			toast.info( "All players have declared wins. Starting round..." );
		},
		handleDealWinDeclaredEvent: ( { deal, by, wins } ) => {
			set(
				produce<GameStore>( state => {
					const idx = state.data.deals.findIndex( d => d.id === deal.id );
					state.data.deals[ idx ] = { ...deal, rounds: [] };
				} )
			);

			toast.info( `${ by.name } declared ${ wins } wins for the deal!` );
		},
		handleRoundCreatedEvent: ( round ) => {
			set(
				produce<GameStore>( state => {
					const idx = state.data.deals.findIndex( d => d.id === round.dealId );
					state.data.deals[ idx ]!.rounds = [ round, ...state.data.deals[ idx ]!.rounds ];
					state.data.deals[ idx ]!.status = "IN_PROGRESS";
				} )
			);

			toast.info( `Round started!` );
		},
		handleCardPlayedEvent: ( { round, by, card } ) => {
			set(
				produce<GameStore>( state => {
					const dealIdx = state.data.deals.findIndex( d => d.id === round.dealId );
					const roundIdx = state.data.deals[ dealIdx ]!.rounds.findIndex( r => r.id === round.id );
					state.data.deals[ dealIdx ]!.rounds[ roundIdx ] = round;

					if ( by === state.data.playerId ) {
						state.data.hand.removeCard( card );
					}
				} )
			);
		},
		handleRoundCompletedEvent: ( { round, deal, winner } ) => {
			set(
				produce<GameStore>( state => {
					const dealIdx = state.data.deals.findIndex( d => d.id === round.dealId );
					state.data.deals[ dealIdx ] = deal;
					const roundIdx = state.data.deals[ dealIdx ]!.rounds.findIndex( r => r.id === round.id );
					state.data.deals[ dealIdx ]!.rounds[ roundIdx ] = round;
				} )
			);

			toast.info( `Round completed! ${ winner.name } won!` );
		},
		handleDealCompletedEvent: ( { deal, score } ) => {
			set(
				produce<GameStore>( state => {
					const idx = state.data.deals.findIndex( d => d.id === deal.id );
					state.data.deals[ idx ] = deal;
					state.data.game.scores = [ score, ...state.data.game.scores as Record<string, number>[] ];
				} )
			);

			toast.info( `Deal completed! Starting next deal...` );
		},
		handleStatusUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.game.status = data;
				} )
			);
		},
		handleCardsDealtEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.hand = CardHand.from( data.map( PlayingCard.from ) );
				} )
			);
		},
		handleGameCompletedEvent: () => {
			set(
				produce<GameStore>( state => {
					state.data.game.status = "COMPLETED";
				} )
			);
		}
	}
} ) );