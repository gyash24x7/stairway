import { CardSet, getPlayingCardFromId, shuffle } from "@common/cards";
import { LoggerFactory } from "@common/core";
import type {
	AskMoveData,
	CallMoveData,
	CardsData,
	GameData,
	HandData,
	Move,
	PlayerData,
	ScoreUpdate,
	TeamData,
	TransferMoveData
} from "@literature/data";
import { EventBus, EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { LiteratureService } from "../utils";
import { GameCompletedEvent } from "./game.completed.event";
import { HandsUpdatedEvent } from "./hands.updated.event";
import { TurnUpdatedEvent } from "./turn.updated.event";

export class MoveCreatedEvent implements IEvent {
	constructor(
		public readonly gameData: GameData,
		public readonly cardsData: CardsData,
		public readonly move: Move
	) {}
}

@EventsHandler( MoveCreatedEvent )
export class MoveCreatedEventHandler implements IEventHandler<MoveCreatedEvent> {

	private readonly logger = LoggerFactory.getLogger( MoveCreatedEventHandler );

	constructor(
		private readonly service: LiteratureService,
		private readonly eventBus: EventBus
	) {}

	async handle( { move, cardsData, gameData }: MoveCreatedEvent ) {
		this.logger.debug( ">> handleMoveCreatedEvent()" );

		await this.updateHands( move, cardsData! );
		await this.updateTurn( gameData!.currentTurn, move, gameData!.players );
		await this.updateScore( move, gameData!.players, gameData!.teams );

		// realtimeService.publishRoomMessage(
		// 	Constants.LITERATURE,
		// 	gameId,
		// 	GameEvents.MOVE_CREATED,
		// 	move
		// );

		this.logger.debug( "<< handleMoveCreatedEvent()" );
	}

	private async updateTurn( currentTurn: string, currentMove: Move, players: PlayerData ) {
		this.logger.debug( ">> updateTurn()" );
		let nextTurn: string;

		switch ( currentMove.type ) {
			case "ASK_CARD": {
				this.logger.debug( "CurrentMove is ASK_MOVE!" );
				const { from, by } = currentMove.data as AskMoveData;
				nextTurn = !currentMove.success ? from : by;
				break;
			}

			case "CALL_SET": {
				this.logger.debug( "CurrentMoveType is CALL_SET!" );
				const { by } = currentMove.data as CallMoveData;
				const currentTeam = players[ by ].teamId;
				const [ player ] = shuffle( Object.values( players )
					.filter( player => player.teamId !== currentTeam ) );
				nextTurn = !currentMove.success ? player.id : by;
				break;
			}

			default: {
				this.logger.debug( "CurrentMoveType is TRANSFER_TURN!" );
				const data = currentMove.data as TransferMoveData;
				nextTurn = data.to;
				break;
			}
		}

		if ( nextTurn !== currentTurn ) {
			await this.service.updateCurrentTurn( currentMove.gameId, nextTurn );
			this.eventBus.publish( new TurnUpdatedEvent( currentMove.gameId, players, nextTurn ) );
			this.logger.debug( "Published TurnUpdatedEvent!" );
		}

		this.logger.debug( "<< updateTurn()" );
		return nextTurn;
	};

	private async updateHands( currentMove: Move, cardsData: CardsData ) {
		this.logger.debug( ">> updateHands()" );

		let hasCardTransferHappened = false;

		switch ( currentMove.type ) {
			case "ASK_CARD":
				const { card, by } = currentMove.data as AskMoveData;
				if ( currentMove.success ) {
					await this.service.updateCardMapping( card, currentMove.gameId, by );
					cardsData.mappings[ card ] = by;
					hasCardTransferHappened = true;
				}
				break;

			case "CALL_SET":
				const { correctCall } = currentMove.data as CallMoveData;
				const calledCards = Object.keys( correctCall );
				await this.service.deleteCardMappings( calledCards, currentMove.gameId );
				calledCards.map( cardId => {
					delete cardsData.mappings[ cardId ];
				} );

				hasCardTransferHappened = true;
				break;
		}

		const updatedHands: HandData = {};
		Object.keys( cardsData.mappings ).map( cardId => {
			const playerId = cardsData.mappings[ cardId ];
			if ( !updatedHands[ playerId ] ) {
				updatedHands[ playerId ] = [];
			}
			updatedHands[ playerId ].push( getPlayingCardFromId( cardId ) );
		} );

		cardsData.hands = updatedHands;

		if ( hasCardTransferHappened ) {
			this.eventBus.publish( new HandsUpdatedEvent( currentMove.gameId, updatedHands ) );
			this.logger.debug( "Published HandsUpdated Event!" );
		}

		this.logger.debug( "<< updateHands()" );
		return updatedHands;
	};

	private async updateScore( currentMove: Move, players: PlayerData, teams: TeamData ) {
		this.logger.debug( ">> updateScore()" );

		if ( currentMove.type !== "CALL_SET" ) {
			this.logger.warn( "Current Move is not Call Set, Not Updating Score!" );
			return;
		}

		const { by, cardSet } = currentMove.data as CallMoveData;
		let winningTeamId = players[ by ].teamId!;

		if ( !currentMove.success ) {
			const [ player ] = Object.values( players ).filter( player => player.teamId !== winningTeamId );
			winningTeamId = player.teamId!;
		}

		await this.service.updateTeamScore( winningTeamId, teams[ winningTeamId ].score + 1 );

		const scoreUpdate: ScoreUpdate = {
			teamId: teams[ winningTeamId ].id,
			score: teams[ winningTeamId ].score + 1,
			setWon: cardSet as CardSet
		};

		const setsCompleted: CardSet[] = [ scoreUpdate.setWon ];
		Object.values( teams ).forEach( team => {
			setsCompleted.push( ...team.setsWon as CardSet[] );
		} );

		// realtimeService.publishRoomMessage(
		// 	Constants.LITERATURE,
		// 	currentMove.gameId,
		// 	GameEvents.SCORE_UPDATED,
		// 	scoreUpdate
		// );

		if ( setsCompleted.length === 8 ) {
			await this.service.updateGameStatus( currentMove.gameId, "COMPLETED" );
			this.eventBus.publish( new GameCompletedEvent( currentMove.gameId ) );
		}

		this.logger.debug( "<< updateScore()" );
		return scoreUpdate;
	};
}