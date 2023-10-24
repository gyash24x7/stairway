import type {
	CardInferences,
	CardMapping,
	CardMappingData,
	GameData,
	HandData,
	Player,
	RawGameData,
	TeamWithMembers
} from "@literature/types";
import { getPlayingCardFromId, SORTED_DECK } from "@s2h/cards";

export function buildHandData( cardMappings: Record<string, string> ): HandData {
	const data: HandData = {};
	Object.keys( cardMappings ).map( cardId => {
		const playerId = cardMappings[ cardId ];
		if ( !data[ playerId ] ) {
			data[ playerId ] = [];
		}
		data[ playerId ].push( getPlayingCardFromId( cardId ) );
	} );
	return data;
}

export function buildCardMappingData( cardMappings: CardMapping[] ): CardMappingData {
	const cardMappingData: CardMappingData = {};
	cardMappings.forEach( cardMapping => {
		cardMappingData[ cardMapping.cardId ] = cardMapping.playerId;
	} );
	return cardMappingData;
}

export function buildGameData( data: RawGameData ): GameData {
	const teamMap: Record<string, TeamWithMembers> = {};
	data.teams?.forEach( team => {
		teamMap[ team.id ] = { ...team, members: [] };
	} );

	const playerMap: Record<string, Player> = {};
	data.players.forEach( player => {
		playerMap[ player.id ] = player;
		if ( !!player.teamId ) {
			teamMap[ player.teamId ].members.push( player.id );
		}
	} );

	const cardCounts: Record<string, number> = {};
	data.cardMappings?.forEach( cardMapping => {
		if ( !cardCounts[ cardMapping.playerId ] ) {
			cardCounts[ cardMapping.playerId ] = 0;
		}
		cardCounts[ cardMapping.playerId ]++;
	} );

	return { ...data, players: playerMap, teams: teamMap, cardCounts, moves: data.moves ?? [] };
}

export function buildDefaultCardInferences( playerIds: string[], playerId: string, cards: string[] ) {
	const cardInferences: CardInferences = {};
	const defaultProbablePlayers = playerIds.filter( player => player !== playerId );

	SORTED_DECK.forEach( card => {
		if ( !cards.includes( card.id ) ) {
			cardInferences[ card.id ] = [ playerId ];
		} else {
			cardInferences[ card.id ] = defaultProbablePlayers;
		}
	} );

	return cardInferences;
}