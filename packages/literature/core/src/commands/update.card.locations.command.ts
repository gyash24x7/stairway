import { LoggerFactory } from "@common/core";
import type { AskMove, CallMove, CardLocationsData, GameData, Move, PlayerData } from "@literature/data";
import { CommandHandler, EventBus, type ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { CardLocationsUpdatedEvent } from "../events";
import { DatabaseService } from "../services";
import { Constants } from "../utils";

export class UpdateCardLocationsCommand implements ICommand {
	constructor(
		public readonly currentMove: Move,
		public readonly gameData: GameData
	) {}
}

@CommandHandler( UpdateCardLocationsCommand )
export class UpdateCardLocationsCommandHandler implements ICommandHandler<UpdateCardLocationsCommand, CardLocationsData> {

	private readonly logger = LoggerFactory.getLogger( UpdateCardLocationsCommandHandler );

	constructor(
		private readonly db: DatabaseService,
		private readonly eventBus: EventBus
	) {}

	async execute( { gameData, currentMove }: UpdateCardLocationsCommand ) {
		this.logger.debug( ">> updateCardLocations()" );
		let cardLocationsData: CardLocationsData = {};

		switch ( currentMove.type ) {
			case "ASK_CARD":
				cardLocationsData = await this.updateCardLocationsOnAskMove( currentMove as AskMove, gameData.players );
				break;

			case "CALL_SET":
				cardLocationsData =
					await this.updateCardLocationsOnCallMove( currentMove as CallMove, gameData.players );
				break;
		}

		const event = new CardLocationsUpdatedEvent( gameData.id, cardLocationsData );
		this.eventBus.publish( event );

		this.logger.debug( "<< updateCardLocations()" );
		return cardLocationsData;
	}

	private async updateCardLocationsOnCallMove( move: CallMove, players: PlayerData ) {
		const cardLocationsData: CardLocationsData = {};

		for ( const playerId in Object.keys( players ) ) {
			const cardLocations = await this.db.getCardLocationsForPlayer( move.gameId, playerId );
			const cardIds = Object.keys( move.data.correctCall );
			await this.db.deleteCardLocationForCards( move.gameId, cardIds );
			cardLocationsData[ playerId ] = cardLocations.filter( cl => cardIds.includes( cl.cardId ) );
		}

		return cardLocationsData;
	}

	private async updateCardLocationsOnAskMove( move: AskMove, players: PlayerData ) {
		const cardLocationsData: CardLocationsData = {};

		for ( const playerId of Object.keys( players ) ) {
			const cardLocations = await this.db.getCardLocationsForPlayer( move.gameId, playerId );
			const index = cardLocations.findIndex( cl => cl.cardId === move.data.card );

			if ( index === -1 ) {
				continue;
			}

			cardLocationsData[ playerId ] = cardLocations.toSpliced( index, 1 );

			const cardLocation = cardLocations[ index ];
			cardLocation.playerIds = cardLocation.playerIds.filter( p => p !== move.data.by && p !== move.data.from );
			cardLocation.weight = Constants.MAX_ASK_WEIGHT / cardLocation.playerIds.length;

			if ( move.success ) {
				await this.db.deleteCardLocationForPlayer( move.gameId, playerId, move.data.card );

			} else {
				await this.db.updateCardLocationForPlayer( cardLocation );
			}

			cardLocationsData[ playerId ].push( cardLocation );
		}

		return cardLocationsData;
	}
}