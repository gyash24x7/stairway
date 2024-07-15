import { LoggerFactory } from "@backend/utils";
import { CardHand, CardSet, PlayingCard, shuffle } from "@common/cards";
import { CommandBus, EventBus, EventsHandler, type IEvent, type IEventHandler } from "@nestjs/cqrs";
import { UpdateCardLocationsCommand } from "../commands";
import { GameEvents } from "../literature.constants.ts";
import { LiteratureGateway } from "../literature.gateway.ts";
import { LiteratureRepository } from "../literature.repository.ts";
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
} from "../literature.types.ts";
import { GameCompletedEvent } from "./game.completed.event.ts";
import { HandsUpdatedEvent } from "./hands.updated.event.ts";

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
		private readonly repository: LiteratureRepository,
		private readonly commandBus: CommandBus,
		private readonly eventBus: EventBus,
		private readonly gateway: LiteratureGateway
	) {}

	async handle( { move, cardsData, gameData }: MoveCreatedEvent ) {
		this.logger.debug( ">> handleMoveCreatedEvent()" );

		await this.updateHands( move, gameData, cardsData );
		await this.updateTurn( move, gameData, cardsData );
		await this.updateScore( move, gameData.players, gameData.teams );
		await this.updateCardLocations( move, gameData );

		this.gateway.publishGameEvent( move.gameId, GameEvents.MOVE_CREATED, move );

		this.logger.debug( "<< handleMoveCreatedEvent()" );
	}

	private async updateTurn( currentMove: Move, gameData: GameData, cardsData: CardsData ) {
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
				const currentPlayer = gameData.players[ by ];
				const playersWithCards = shuffle( Object.values( gameData.players )
					.filter( player => !cardsData.hands[ player.id ].isEmpty() ) );

				const oppositeTeamPlayersWithCards = playersWithCards.filter( player => player.teamId !== currentPlayer.teamId );
				const teamPlayersWithCards = playersWithCards.filter( player => player.teamId === currentPlayer.teamId );

				if ( currentMove.success ) {
					if ( !cardsData.hands[ currentPlayer.id ].isEmpty() ) {
						nextTurn = currentPlayer.id;
					} else {
						if ( teamPlayersWithCards.length !== 0 ) {
							nextTurn = teamPlayersWithCards[ 0 ].id;
						} else {
							nextTurn = oppositeTeamPlayersWithCards[ 0 ].id;
						}
					}
				} else {
					if ( oppositeTeamPlayersWithCards.length !== 0 ) {
						nextTurn = oppositeTeamPlayersWithCards[ 0 ].id;
					} else {
						nextTurn = currentPlayer.id;
					}
				}

				break;
			}

			default: {
				this.logger.debug( "CurrentMoveType is TRANSFER_TURN!" );
				const data = currentMove.data as TransferMoveData;
				nextTurn = data.to;
				break;
			}
		}

		if ( nextTurn !== gameData.currentTurn ) {
			await this.repository.updateCurrentTurn( currentMove.gameId, nextTurn );
			this.gateway.publishGameEvent( gameData.id, GameEvents.TURN_UPDATED, nextTurn );
			this.logger.debug( "Published TurnUpdatedEvent!" );
		}

		this.logger.debug( "<< updateTurn()" );
		return nextTurn;
	};

	private async updateHands( currentMove: Move, gameData: GameData, cardsData: CardsData ) {
		this.logger.debug( ">> updateHands()" );

		let hasCardTransferHappened = false;

		switch ( currentMove.type ) {
			case "ASK_CARD":
				const { card, by } = currentMove.data as AskMoveData;
				if ( currentMove.success ) {
					await this.repository.updateCardMapping( card, currentMove.gameId, by );
					cardsData.mappings[ card ] = by;
					hasCardTransferHappened = true;
				}
				break;

			case "CALL_SET":
				const { correctCall } = currentMove.data as CallMoveData;
				const calledCards = Object.keys( correctCall );
				await this.repository.deleteCardMappings( calledCards, currentMove.gameId );
				calledCards.map( cardId => {
					delete cardsData.mappings[ cardId ];
				} );

				hasCardTransferHappened = true;
				break;
		}

		const updatedHands: HandData = {};
		Object.keys( gameData.players ).forEach( playerId => {
			updatedHands[ playerId ] = CardHand.empty();
		} );

		Object.keys( cardsData.mappings ).map( cardId => {
			const playerId = cardsData.mappings[ cardId ];
			updatedHands[ playerId ].cards.push( PlayingCard.fromId( cardId ) );
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

		teams[ winningTeamId ].setsWon.push( cardSet as CardSet );
		teams[ winningTeamId ].score++;
		await this.repository.updateTeamScore(
			winningTeamId,
			teams[ winningTeamId ].score,
			teams[ winningTeamId ].setsWon
		);

		const scoreUpdate: ScoreUpdate = {
			teamId: teams[ winningTeamId ].id,
			score: teams[ winningTeamId ].score,
			setWon: cardSet as CardSet
		};

		const setsCompleted: CardSet[] = [];
		Object.values( teams ).forEach( team => {
			setsCompleted.push( ...team.setsWon as CardSet[] );
		} );

		this.gateway.publishGameEvent( currentMove.gameId, GameEvents.SCORE_UPDATED, scoreUpdate );
		this.logger.debug( "SetsCompleted: %o", setsCompleted );

		if ( setsCompleted.length === 8 ) {
			await this.repository.updateGameStatus( currentMove.gameId, "COMPLETED" );
			this.eventBus.publish( new GameCompletedEvent( currentMove.gameId ) );
		}

		this.logger.debug( "<< updateScore()" );
		return scoreUpdate;
	};

	private async updateCardLocations( move: Move, gameData: GameData ) {
		this.logger.debug( ">> updateCardLocations()" );

		const command = new UpdateCardLocationsCommand( move, gameData );
		await this.commandBus.execute( command );

		this.logger.debug( "<< updateCardLocations()" );
	}
}