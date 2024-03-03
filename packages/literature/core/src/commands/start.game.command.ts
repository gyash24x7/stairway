import { CardRank, removeCardsOfRank, shuffle, SORTED_DECK } from "@common/cards";
import { LoggerFactory } from "@common/core";
import type { GameData } from "@literature/data";
import { CommandHandler, EventBus, ICommand, ICommandHandler } from "@nestjs/cqrs";
import { GameStartedEvent } from "../events";
import { DatabaseService } from "../services";
import { transformCardsData } from "../utils";

export class StartGameCommand implements ICommand {
	constructor( public readonly gameData: GameData ) {}
}

@CommandHandler( StartGameCommand )
export class StartGameCommandHandler implements ICommandHandler<StartGameCommand, GameData> {

	private readonly logger = LoggerFactory.getLogger( StartGameCommandHandler );

	constructor(
		private readonly db: DatabaseService,
		private readonly eventBus: EventBus
	) {}

	async execute( { gameData }: StartGameCommand ) {
		this.logger.debug( ">> startGame()" );

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

		const cardsData = transformCardsData( cardMappings );

		this.eventBus.publish( new GameStartedEvent( gameData, cardsData ) );
		this.logger.debug( "Published GameStartedEvent!" );

		this.logger.debug( "<< startGame()" );
		return { ...gameData, status: "IN_PROGRESS" as const };
	};
}