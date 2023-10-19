import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { LoggerFactory } from "@s2h/core";
import type { AggregatedGameData } from "@literature/data";
import { GameStatus } from "@literature/data";
import { BadRequestException } from "@nestjs/common";
import { CardRank, removeCardsOfRank, shuffle, SORTED_DECK } from "@s2h/cards";
import { PrismaService } from "../services";
import type { UserAuthInfo } from "@auth/data";
import { GameUpdateEvent } from "../events";
import { buildCardMappingsAndHandMap } from "../utils";
import { Messages } from "../constants";

export class StartGameCommand implements ICommand {
	constructor(
		public readonly currentGame: AggregatedGameData,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( StartGameCommand )
export class StartGameCommandHandler implements ICommandHandler<StartGameCommand, string> {

	private readonly logger = LoggerFactory.getLogger( StartGameCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { currentGame, authInfo }: StartGameCommand ) {
		this.logger.debug( ">> execute()" );
		if ( currentGame!.status !== GameStatus.TEAMS_CREATED ) {
			this.logger.debug( "%s GameId: %s", Messages.TEAMS_NOT_CREATED, currentGame.id );
			throw new BadRequestException( Messages.TEAMS_NOT_CREATED );
		}

		let deck = shuffle( SORTED_DECK );
		deck = removeCardsOfRank( deck, CardRank.SEVEN );

		const cardMappings = await Promise.all(
			deck.map( ( card, index ) => {
				return this.prisma.cardMapping.create( {
					data: {
						cardId: card.id,
						gameId: currentGame.id,
						playerId: currentGame.playerList[ index % currentGame.playerCount ].id
					}
				} );
			} )
		);

		const { cardMappingMap, handMap } = buildCardMappingsAndHandMap( cardMappings );

		const [ playerId ] = shuffle( currentGame.playerList.map( player => player.id ) );

		await this.prisma.game.update( {
			where: { id: currentGame.id },
			data: {
				status: GameStatus.IN_PROGRESS,
				currentTurn: playerId
			}
		} );

		currentGame.status = GameStatus.IN_PROGRESS;
		currentGame.cardMappings = cardMappingMap;
		currentGame.currentTurn = playerId;
		currentGame.hands = handMap;

		this.eventBus.publish( new GameUpdateEvent( currentGame, authInfo ) );

		return currentGame.id;
	}
}