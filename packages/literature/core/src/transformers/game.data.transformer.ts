import type { GameData, GameStatus, Player, RawGameData, TeamWithMembers } from "@literature/types";
import { Injectable } from "@nestjs/common";
import { DataTransformer, LoggerFactory } from "@s2h/core";

@Injectable()
export class GameDataTransformer implements DataTransformer<RawGameData, GameData> {

	private readonly logger = LoggerFactory.getLogger( GameDataTransformer );

	transform( data: RawGameData ) {
		this.logger.debug( ">> transformGameData()" );
		const teamMap: Record<string, TeamWithMembers> = {};
		data.teams?.forEach( team => {
			teamMap[ team.id ] = { ...team, members: [] };
		} );

		const playerMap: Record<string, Player> = {};
		data.players.forEach( player => {
			playerMap[ player.id ] = player;
			if ( !!player.teamId ) {
				teamMap[ player.teamId ]?.members.push( player.id );
			}
		} );

		const cardCounts: Record<string, number> = {};
		data.cardMappings?.forEach( cardMapping => {
			if ( !cardCounts[ cardMapping.playerId ] ) {
				cardCounts[ cardMapping.playerId ] = 0;
			}
			cardCounts[ cardMapping.playerId ]++;
		} );

		this.logger.debug( "<< transformGameData()" );
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