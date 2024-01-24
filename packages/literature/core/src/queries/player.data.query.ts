import { getCardSetsInHand } from "@common/cards";
import { LoggerFactory } from "@common/core";
import type { GameData, PlayerSpecificData } from "@literature/data";
import { IQuery, IQueryHandler, QueryBus, QueryHandler } from "@nestjs/cqrs";
import { CardsDataQuery } from "./cards.data.query";

export class PlayerDataQuery implements IQuery {
	constructor(
		public readonly playerId: string,
		public readonly gameData: GameData
	) {}
}

@QueryHandler( PlayerDataQuery )
export class PlayerDataQueryHandler implements IQueryHandler<PlayerDataQuery> {

	private readonly logger = LoggerFactory.getLogger( PlayerDataQueryHandler );

	constructor( private readonly queryBus: QueryBus ) {}

	async execute( { playerId, gameData }: PlayerDataQuery ) {
		this.logger.debug( ">> getPlayerSpecificData()" );

		const cardsDataQuery = new CardsDataQuery( gameData.id, playerId );
		const { hands } = await this.queryBus.execute( cardsDataQuery );

		const { teamId, ...info } = gameData.players[ playerId ];
		const cardSets = getCardSetsInHand( hands[ playerId ] ?? [] );

		let oppositeTeamId: string | undefined = undefined;
		if ( !!teamId ) {
			oppositeTeamId = Object.values( gameData.teams ).find( team => team.id !== teamId )?.id;
		}

		const data: PlayerSpecificData = {
			...info,
			hand: hands[ playerId ] ?? [],
			cardSets,
			oppositeTeamId,
			teamId
		};

		this.logger.debug( "<< getPlayerSpecificData()" );
		return data;
	};
}