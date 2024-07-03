import { LoggerFactory } from "@backend/utils";
import { type IQuery, type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { LiteratureRepository } from "../literature.repository.ts";
import type { GameData, GameStatus, Player, RawGameData, Team } from "../literature.types.ts";

export class GameDataQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( GameDataQuery )
export class GameDataQueryHandler implements IQueryHandler<GameDataQuery, GameData | null> {

	private readonly logger = LoggerFactory.getLogger( GameDataQueryHandler );

	constructor( private readonly repository: LiteratureRepository ) {}

	async execute( { gameId }: GameDataQuery ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.repository.getGameById( gameId );

		this.logger.debug( "<< getGameData()" );
		return !!data ? this.transformGameData( data ) : null;
	};

	private transformGameData( data: RawGameData ): GameData {
		const teamMap: Record<string, Team> = {};

		const cardCounts: Record<string, number> = {};
		data.cardMappings?.forEach( cardMapping => {
			if ( !cardCounts[ cardMapping.playerId ] ) {
				cardCounts[ cardMapping.playerId ] = 0;
			}
			cardCounts[ cardMapping.playerId ]++;
		} );

		data.teams?.forEach( team => {
			teamMap[ team.id ] = team;
		} );

		const playerMap: Record<string, Player> = {};
		data.players.forEach( player => {
			playerMap[ player.id ] = player;
		} );

		return {
			...data,
			players: playerMap,
			teams: teamMap,
			cardCounts,
			moves: data.moves!,
			status: data.status as GameStatus
		};
	}
}