import type { CardMapping, GameData } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { CardRank, removeCardsOfRank, shuffle, SORTED_DECK } from "@s2h/cards";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { GameStartedEvent } from "../events";
import { buildCardMappingData } from "../utils";

export class StartGameCommand implements ICommand {
	constructor( public readonly gameData: GameData ) {}
}

@CommandHandler( StartGameCommand )
export class StartGameCommandHandler implements ICommandHandler<StartGameCommand, CardMapping[]> {

	private readonly logger = LoggerFactory.getLogger( StartGameCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { gameData }: StartGameCommand ) {
		this.logger.debug( ">> executeStartGameCommand()" );

		let deck = shuffle( SORTED_DECK );
		deck = removeCardsOfRank( deck, CardRank.SEVEN );
		const playerIds = Object.keys( gameData.players );

		const cardMappings = await Promise.all(
			deck.map( ( card, index ) => {
				return this.prisma.literature.cardMapping.create( {
					data: {
						cardId: card.id,
						gameId: gameData.id,
						playerId: playerIds[ index % gameData.playerCount ]
					}
				} );
			} )
		);

		const cardMappingData = buildCardMappingData( cardMappings );
		this.eventBus.publish( new GameStartedEvent( gameData, cardMappingData ) );
		this.logger.debug( "Published GameStartedEvent!" );

		this.logger.debug( "<< executeStartGameCommand()" );
		return cardMappings;
	}
}