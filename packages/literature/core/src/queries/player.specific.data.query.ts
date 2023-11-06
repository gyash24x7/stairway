import type { GameData, PlayerSpecificData } from "@literature/types";
import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import { getCardSetsInHand, getPlayingCardFromId } from "@s2h/cards";
import { LoggerFactory, PrismaService } from "@s2h/core";

export class PlayerSpecificDataQuery implements IQuery {
	constructor(
		public readonly gameData: GameData,
		public readonly playerId: string
	) {}
}

@QueryHandler( PlayerSpecificDataQuery )
export class PlayerSpecificDataQueryHandler implements IQueryHandler<PlayerSpecificDataQuery, PlayerSpecificData> {

	private readonly logger = LoggerFactory.getLogger( PlayerSpecificDataQueryHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { playerId, gameData }: PlayerSpecificDataQuery ) {
		this.logger.debug( ">> executePlayerDataQuery()" );

		const cardMappings = await this.prisma.literature.cardMapping.findMany( {
			where: { gameId: gameData.id, playerId }
		} );

		const { teamId, ...info } = gameData.players[ playerId ];
		const hand = cardMappings.map( card => getPlayingCardFromId( card.cardId ) );
		const cardSets = getCardSetsInHand( hand );

		let oppositeTeamId: string | undefined = undefined;
		if ( !!teamId ) {
			oppositeTeamId = Object.values( gameData.teams ).find( team => team.id !== teamId )?.id;
		}

		this.logger.debug( "<< executePlayerDataQuery()" );
		return { ...info, hand, cardSets, oppositeTeamId, teamId };
	}
}