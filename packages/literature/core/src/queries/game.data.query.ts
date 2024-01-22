import { LoggerFactory } from "@common/core";
import type { GameData } from "@literature/data";
import { type IQuery, IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { LiteratureService, LiteratureTransformers } from "../utils";

export class GameDataQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( GameDataQuery )
export class GameDataQueryHandler implements IQueryHandler<GameDataQuery, GameData | null> {

	private readonly logger = LoggerFactory.getLogger( GameDataQueryHandler );

	constructor(
		private readonly service: LiteratureService,
		private readonly transformers: LiteratureTransformers
	) {}

	async execute( { gameId }: GameDataQuery ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.service.getGameById( gameId );

		this.logger.debug( "<< getGameData()" );
		return !!data ? this.transformers.transformGameData( data ) : null;
	};
}