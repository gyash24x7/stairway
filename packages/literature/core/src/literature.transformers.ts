import type {
	CardMapping,
	CardMappingData,
	CardsData,
	GameStatus,
	HandData,
	Player,
	RawGameData,
	TeamWithMembers
} from "@literature/types";
import { getPlayingCardFromId } from "@s2h/cards";
import { LoggerFactory } from "@s2h/core";

export class LiteratureTransformers {

	private readonly logger = LoggerFactory.getLogger( LiteratureTransformers );

	gameData( data: RawGameData ) {
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

	cardsData( cardMappings: CardMapping[] ): CardsData {
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

export const literatureTransformers = new LiteratureTransformers();