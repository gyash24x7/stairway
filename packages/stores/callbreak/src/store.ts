import { observable } from "@legendapp/state";
import type { Deal, DealWithRounds, Game, Player, PlayerData, Round, Status } from "@stairway/api/callbreak";
import { getCardId, type PlayingCard } from "@stairway/cards";
import { toast } from "sonner";

export type PlayerGameData = {
	playerId: string;
	game: Game;
	players: PlayerData;
	currentDeal?: Deal | null;
	currentRound?: Round | null;
	hand: PlayingCard[];
}

export type GameEventHandlers = {
	handlePlayerJoinedEvent: ( newPlayer: Player ) => void;
	handleAllPlayersJoinedEvent: () => void;
	handleDealCreatedEvent: ( deal: Deal ) => void;
	handleDealWinDeclaredEvent: ( data: { deal: Deal, by: Player, wins: number } ) => void;
	handleAllDealWinsDeclaredEvent: () => void;
	handleRoundCreatedEvent: ( data: { deal: Deal, round: Round } ) => void;
	handleCardPlayedEvent: ( data: { round: Round, by: string, card: string } ) => void;
	handleRoundCompletedEvent: ( data: { round: Round; deal: DealWithRounds, winner: Player } ) => void;
	handleDealCompletedEvent: ( data: { deal: DealWithRounds, score: Record<string, number> } ) => void;
	handleStatusUpdatedEvent: ( status: Status ) => void;
	handleGameCompletedEvent: () => void;
	handleCardsDealtEvent: ( cards: PlayingCard[] ) => void;
}

export type GameStore = {
	data: PlayerGameData;
	eventHandlers: GameEventHandlers;
}

export const callbreak$ = observable<GameStore>( {
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
		hand: []
	},
	eventHandlers: {
		handlePlayerJoinedEvent: ( newPlayer ) => {
			callbreak$.data.players.set( { ...callbreak$.data.players.get(), [ newPlayer.id ]: newPlayer } );
			toast.success( `${ newPlayer.name } joined the game!` );
		},
		handleAllPlayersJoinedEvent: () => {
			callbreak$.data.game.status.set( "IN_PROGRESS" );
			toast.info( "All players have joined the game. Starting round..." );
		},
		handleDealCreatedEvent: ( deal ) => {
			callbreak$.data.currentDeal.set( deal );
			toast.info( "Deal created. Waiting for all players to declare wins..." );
		},
		handleAllDealWinsDeclaredEvent: () => {
			toast.info( "All players have declared wins. Starting round..." );
		},
		handleDealWinDeclaredEvent: ( { deal, by, wins } ) => {
			callbreak$.data.currentDeal.set( deal );
			toast.info( `${ by.name } declared ${ wins } wins for the deal!` );
		},
		handleRoundCreatedEvent: ( { deal, round } ) => {
			callbreak$.data.currentDeal.set( deal );
			callbreak$.data.currentRound.set( round );
			toast.info( `Round started!` );
		},
		handleCardPlayedEvent: ( { round, by, card } ) => {
			callbreak$.data.currentRound.set( round );
			if ( by === callbreak$.data.playerId.get() ) {
				callbreak$.data.hand.set( callbreak$.data.hand.get().filter( c => getCardId( c ) !== card ) );
			}
		},
		handleRoundCompletedEvent: ( { deal, winner } ) => {
			callbreak$.data.currentRound.set( undefined );
			callbreak$.data.currentDeal.set( deal );
			toast.info( `Round completed! ${ winner.name } won!` );
		},
		handleDealCompletedEvent: ( { score } ) => {
			callbreak$.data.currentDeal.set( undefined );
			const scores = callbreak$.data.game.scores.get();
			scores.push( score );
			callbreak$.data.game.scores.set( scores );

			toast.info( `Deal completed! Starting next deal...` );
		},
		handleStatusUpdatedEvent: ( status ) => {
			callbreak$.data.game.status.set( status );
		},
		handleCardsDealtEvent: ( cards ) => {
			callbreak$.data.hand.set( cards );
		},
		handleGameCompletedEvent: () => {
			callbreak$.data.game.status.set( "COMPLETED" );
		}
	}
} );