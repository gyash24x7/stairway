import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import type { CardInferences, GameData, PlayerSpecificData } from "@literature/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { getCardSetsInHand, getPlayingCardFromId } from "@s2h/cards";

export class PlayerDataQuery implements IQuery {
	constructor(
		public readonly gameData: GameData,
		public readonly playerId: string
	) {}
}

@QueryHandler( PlayerDataQuery )
export class PlayerDataQueryHandler implements IQueryHandler<PlayerDataQuery, PlayerSpecificData> {

	private readonly logger = LoggerFactory.getLogger( PlayerDataQueryHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { playerId, gameData }: PlayerDataQuery ) {
		this.logger.debug( ">> executePlayerDataQuery()" );

		const cardMappings = await this.prisma.literature.player
			.findUniqueOrThrow( { where: { id_gameId: { id: playerId, gameId: gameData.id } } } )
			.cards();

		const { inferences, ...info } = gameData.players[ playerId ];
		const hand = cardMappings.map( card => getPlayingCardFromId( card.cardId ) );
		const cardSets = getCardSetsInHand( hand );

		this.logger.debug( "<< executePlayerDataQuery()" );
		return { ...info, inferences: inferences as CardInferences, hand, cardSets };
	}
}