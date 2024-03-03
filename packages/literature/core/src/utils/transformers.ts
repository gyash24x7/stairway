import { getPlayingCardFromId } from "@common/cards";
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


export function transformGameData( data: RawGameData ): GameData {
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

export function transformCardsData( cardMappings: CardMapping[] ): CardsData {
	const mappings: CardMappingData = {};
	const hands: HandData = {};

	cardMappings.forEach( cardMapping => {
		if ( !hands[ cardMapping.playerId ] ) {
			hands[ cardMapping.playerId ] = [];
		}

		hands[ cardMapping.playerId ].push( getPlayingCardFromId( cardMapping.cardId ) );
		mappings[ cardMapping.cardId ] = cardMapping.playerId;
	} );

	return { mappings, hands };
}

