import { LoggerFactory } from "@common/core";
import { type IQuery, IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { Game } from "@wordle/data";
import { WordleService } from "../utils";

export class GameDataQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( GameDataQuery )
export class GameDataQueryHandler implements IQueryHandler<GameDataQuery, Game | undefined> {

	private readonly logger = LoggerFactory.getLogger( GameDataQueryHandler );

	constructor( private readonly service: WordleService ) {}

	async execute( { gameId }: GameDataQuery ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.db.getGameById( gameId );

		this.logger.debug( "<< getGameData()" );
		return data;
	};
}