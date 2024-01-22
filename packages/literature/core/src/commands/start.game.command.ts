import { CardRank, removeCardsOfRank, shuffle, SORTED_DECK } from "@common/cards";
import { LoggerFactory } from "@common/core";
import type { GameData } from "@literature/data";
import { CommandHandler, EventBus, ICommand, ICommandHandler } from "@nestjs/cqrs";
import { GameStartedEvent } from "../events";
import { LiteratureService, LiteratureTransformers } from "../utils";

export class StartGameCommand implements ICommand {
	constructor( public readonly gameData: GameData ) {}
}

@CommandHandler( StartGameCommand )
export class StartGameCommandHandler implements ICommandHandler<StartGameCommand> {

	private readonly logger = LoggerFactory.getLogger( StartGameCommandHandler );

	constructor(
		private readonly service: LiteratureService,
		private readonly transformers: LiteratureTransformers,
		private readonly eventBus: EventBus
	) {}

	async execute( { gameData }: StartGameCommand ) {
		this.logger.debug( ">> startGame()" );

		let deck = shuffle( SORTED_DECK );
		deck = removeCardsOfRank( deck, CardRank.SEVEN );
		const playerIds = Object.keys( gameData.players );

		const cardMappings = await this.service.createCardMappings(
			deck.map( ( card, index ) => {
				return {
					cardId: card.id,
					gameId: gameData.id,
					playerId: playerIds[ index % gameData.playerCount ]
				};
			} )
		);

		const cardsData = this.transformers.transformCardsData( cardMappings );

		this.eventBus.publish( new GameStartedEvent( gameData, cardsData ) );
		this.logger.debug( "Published GameStartedEvent!", cardsData );

		this.logger.debug( "<< startGame()" );
		return { ...gameData, status: "IN_PROGRESS" as const };
	};
}