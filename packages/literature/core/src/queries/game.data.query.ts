import { LoggerFactory } from "@common/core";
import type { GameData } from "@literature/data";
import { type IQuery, IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { DatabaseService } from "../services";
import { transformGameData } from "../utils";

export class GameDataQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( GameDataQuery )
export class GameDataQueryHandler implements IQueryHandler<GameDataQuery, GameData | null> {

	private readonly logger = LoggerFactory.getLogger( GameDataQueryHandler );

	constructor( private readonly db: DatabaseService ) {}

	async execute( { gameId }: GameDataQuery ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.db.getGameById( gameId );

		this.logger.debug( "<< getGameData()" );
		return !!data ? transformGameData( data ) : null;
	};
}