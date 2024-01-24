import { getPlayingCardFromId } from "@common/cards";
import { LoggerFactory } from "@common/core";
import type {
	CardMapping,
	CardMappingData,
	CardsData,
	GameData,
	GameStatus,
	HandData,
	Player,
	RawGameData,
	Team
} from "@literature/data";
import { Injectable } from "@nestjs/common";

@Injectable()
export class LiteratureTransformers {

	private readonly logger = LoggerFactory.getLogger( LiteratureTransformers );

	transformGameData( data: RawGameData ): GameData {
		this.logger.debug( ">> transformGameData()" );
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

	transformCardsData( cardMappings: CardMapping[] ): CardsData {
		this.logger.debug( ">> transformCardMappings()" );

		const mappings: CardMappingData = {};
		const hands: HandData = {};

		cardMappings.forEach( cardMapping => {
			if ( !hands[ cardMapping.playerId ] ) {
				hands[ cardMapping.playerId ] = [];
			}

			hands[ cardMapping.playerId ].push( getPlayingCardFromId( cardMapping.cardId ) );
			mappings[ cardMapping.cardId ] = cardMapping.playerId;
		} );

		this.logger.debug( "<< transformCardMappings()" );
		return { mappings, hands };
	}
}
