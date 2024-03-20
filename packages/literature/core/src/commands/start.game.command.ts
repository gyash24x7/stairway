import { CardRank, removeCardsOfRank, shuffle, SORTED_DECK } from "@common/cards";
import { LoggerFactory } from "@common/core";
import type { CardLocation, CardLocationsData, CardsData, GameData } from "@literature/data";
import { CommandHandler, EventBus, ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CardLocationsUpdatedEvent, HandsUpdatedEvent } from "../events";
import { DatabaseService, GatewayService } from "../services";
import { Constants, GameEvents, transformCardsData } from "../utils";

export class StartGameCommand implements ICommand {
	constructor( public readonly gameData: GameData ) {}
}

@CommandHandler( StartGameCommand )
export class StartGameCommandHandler implements ICommandHandler<StartGameCommand, GameData> {

	private readonly logger = LoggerFactory.getLogger( StartGameCommandHandler );

	constructor(
		private readonly db: DatabaseService,
		private readonly gateway: GatewayService,
		private readonly eventBus: EventBus
	) {}

	async execute( { gameData }: StartGameCommand ) {
		this.logger.debug( ">> startGame()" );

		await this.db.updateGameStatus( gameData.id, "IN_PROGRESS" );

		const cardsData = await this.createCardMappings( gameData );
		const cardLocationsData = await this.createCardLocations( gameData, cardsData );

		const handsUpdatedEvent = new HandsUpdatedEvent( gameData.id, cardsData.hands );
		this.eventBus.publish( handsUpdatedEvent );

		const cardLocationsUpdatedEvent = new CardLocationsUpdatedEvent( gameData.id, cardLocationsData );
		this.eventBus.publish( cardLocationsUpdatedEvent );

		this.gateway.publishGameEvent( gameData.id, GameEvents.STATUS_UPDATED, "IN_PROGRESS" );
		this.logger.debug( "Published StatusUpdatedEvent!" );

		this.logger.debug( "<< startGame()" );
		return { ...gameData, status: "IN_PROGRESS" as const };
	};

	private async createCardLocations( gameData: GameData, cardsData: CardsData ) {
		this.logger.debug( ">> createCardLocations()" );

		const playerIds = Object.keys( gameData.players );
		const cardLocations: CardLocation[] = [];
		const cardLocationsData: CardLocationsData = {};

		const deck = removeCardsOfRank( SORTED_DECK, CardRank.SEVEN );

		for ( const playerId of playerIds ) {
			const otherPlayerIds = playerIds.filter( id => id !== playerId );
			const cardsWithPlayer = cardsData.hands[ playerId ].map( card => card.id );

			const cardLocationsForPlayer = deck.filter( c => !cardsWithPlayer.includes( c.id ) )
				.map( c => {
					const weight = Constants.MAX_ASK_WEIGHT / otherPlayerIds.length;
					return { gameId: gameData.id, cardId: c.id, playerId, playerIds: otherPlayerIds, weight };
				} );

			cardLocations.push( ...cardLocationsForPlayer );
			cardLocationsData[ playerId ] = cardLocationsForPlayer;
		}

		await this.db.createCardLocations( cardLocations );

		this.logger.debug( "<< createCardLocations()" );
		return cardLocationsData;
	}

	private async createCardMappings( gameData: GameData ) {
		let deck = shuffle( SORTED_DECK );
		deck = removeCardsOfRank( deck, CardRank.SEVEN );
		const playerIds = Object.keys( gameData.players );

		const cardMappings = await this.db.createCardMappings(
			deck.map( ( card, index ) => {
				return {
					cardId: card.id,
					gameId: gameData.id,
					playerId: playerIds[ index % gameData.playerCount ]
				};
			} )
		);

		return transformCardsData( cardMappings );
	}
}