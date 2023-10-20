import type { AggregatedGameData, CardMapping, CardMappingData, Player, RawGameData, Team } from "@literature/data";
import { GameStatus } from "@literature/data";
import { getPlayingCardFromId, PlayingCard } from "@s2h/cards";

export function checkIfGameOver( currentGame: AggregatedGameData ) {
	return !Object.values( currentGame.hands ).some( hand => hand.length !== 0 );
}

export function rebuildHands( cardMappings: Record<string, string> ): Record<string, PlayingCard[]> {
	const data: Record<string, PlayingCard[]> = {};
	Object.keys( cardMappings ).map( cardId => {
		const playerId = cardMappings[ cardId ];
		if ( !data[ playerId ] ) {
			data[ playerId ] = [];
		}
		data[ playerId ].push( getPlayingCardFromId( cardId ) );
	} );

	return data;
}

export function buildCardMappingsAndHandMap( cardMappings: CardMapping[] ): CardMappingData {
	const cardMappingMap: Record<string, string> = {};
	const handMap: Record<string, PlayingCard[]> = {};

	cardMappings.forEach( cardMapping => {
		cardMappingMap[ cardMapping.cardId ] = cardMapping.playerId;

		if ( !handMap[ cardMapping.playerId ] ) {
			handMap[ cardMapping.playerId ] = [];
		}

		handMap[ cardMapping.playerId ].push( getPlayingCardFromId( cardMapping.cardId ) );
	} );

	return { cardMappingMap, handMap };
}

export function buildAggregatedGameData( data: RawGameData ): AggregatedGameData {
	const playerMap: Record<string, Player> = {};
	data.players.forEach( player => {
		playerMap[ player.id ] = player;
	} );

	const teamMap: Record<string, Team> = {};
	data.teams?.forEach( team => {
		teamMap[ team.id ] = team;
	} );

	const cardMappingMap: Record<string, string> = {};
	const cardHandMap: Record<string, PlayingCard[]> = {};
	data.cardMappings?.forEach( cardMapping => {
		cardMappingMap[ cardMapping.cardId ] = cardMapping.playerId;

		if ( !cardHandMap[ cardMapping.playerId ] ) {
			cardHandMap[ cardMapping.playerId ] = [];
		}

		cardHandMap[ cardMapping.playerId ].push( getPlayingCardFromId( cardMapping.cardId ) );
	} );

	return {
		...data,
		players: playerMap,
		teams: teamMap,
		cardMappings: cardMappingMap,
		playerList: data.players,
		teamList: data.teams ?? [],
		hands: cardHandMap,
		moves: data.moves ?? []
	};
}

export function areTeamsCreated( status: GameStatus ) {
	return status === GameStatus.TEAMS_CREATED || status === GameStatus.IN_PROGRESS || status === GameStatus.COMPLETED;
}

export function isGameStarted( status: GameStatus ) {
	return status === GameStatus.IN_PROGRESS || status === GameStatus.COMPLETED;
}