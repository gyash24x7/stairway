import { LoggerFactory } from "@backend/utils";
import { type IQuery, type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { WordleRepository } from "../wordle.repository.ts";
import type { Game } from "../wordle.schema.ts";

export class GameDataQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( GameDataQuery )
export class GameDataQueryHandler implements IQueryHandler<GameDataQuery, Game | undefined> {

	private readonly logger = LoggerFactory.getLogger( GameDataQueryHandler );

	constructor( private readonly repository: WordleRepository ) {}

	async execute( { gameId }: GameDataQuery ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.repository.getGameById( gameId );

		this.logger.debug( "<< getGameData()" );
		return data;
	};
}