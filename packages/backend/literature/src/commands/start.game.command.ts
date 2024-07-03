import { LoggerFactory } from "@backend/utils";
import { CardDeck, CardHand, CardRank, PlayingCard } from "@common/cards";
import { CommandHandler, EventBus, type ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { CardLocationsUpdatedEvent, HandsUpdatedEvent } from "../events";
import { Constants, GameEvents } from "../literature.constants.ts";
import { LiteratureGateway } from "../literature.gateway.ts";
import { LiteratureRepository } from "../literature.repository.ts";
import type {
	CardLocation,
	CardLocationsData,
	CardMappingData,
	CardsData,
	GameData,
	HandData
} from "../literature.types.ts";


export class StartGameCommand implements ICommand {
	constructor( public readonly gameData: GameData ) {}
}

@CommandHandler( StartGameCommand )
export class StartGameCommandHandler implements ICommandHandler<StartGameCommand, GameData> {

	private readonly logger = LoggerFactory.getLogger( StartGameCommandHandler );

	constructor(
		private readonly repository: LiteratureRepository,
		private readonly gateway: LiteratureGateway,
		private readonly eventBus: EventBus
	) {}

	async execute( { gameData }: StartGameCommand ) {
		this.logger.debug( ">> startGame()" );

		await this.repository.updateGameStatus( gameData.id, "IN_PROGRESS" );

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

		const deck = new CardDeck();
		deck.removeCardsOfRank( CardRank.SEVEN );

		for ( const playerId of playerIds ) {
			const otherPlayerIds = playerIds.filter( id => id !== playerId );
			const cardsWithPlayer = cardsData.hands[ playerId ].cards.map( card => card.id );

			const cardLocationsForPlayer = deck.cards.map( c => {

				if ( cardsWithPlayer.includes( c.id ) ) {
					return { gameId: gameData.id, cardId: c.id, playerId, playerIds: [ playerId ], weight: 0 };
				}

				const weight = Constants.MAX_ASK_WEIGHT / otherPlayerIds.length;
				return { gameId: gameData.id, cardId: c.id, playerId, playerIds: otherPlayerIds, weight };
			} );

			cardLocations.push( ...cardLocationsForPlayer );
			cardLocationsData[ playerId ] = cardLocationsForPlayer;
		}

		await this.repository.createCardLocations( cardLocations );

		this.logger.debug( "<< createCardLocations()" );
		return cardLocationsData;
	}

	private async createCardMappings( gameData: GameData ) {
		let deck = new CardDeck();
		deck.removeCardsOfRank( CardRank.SEVEN );
		const playerIds = Object.keys( gameData.players );

		const cardMappings = await this.repository.createCardMappings(
			deck.cards.map( ( card, index ) => {
				return {
					cardId: card.id,
					gameId: gameData.id,
					playerId: playerIds[ index % gameData.playerCount ]
				};
			} )
		);

		const mappings: CardMappingData = {};
		const hands: HandData = {};

		cardMappings.forEach( cardMapping => {
			if ( !hands[ cardMapping.playerId ] ) {
				hands[ cardMapping.playerId ] = CardHand.from( [] );
			}

			hands[ cardMapping.playerId ].cards.push( PlayingCard.fromId( cardMapping.cardId ) );
			mappings[ cardMapping.cardId ] = cardMapping.playerId;
		} );

		return { mappings, hands };
	}
}