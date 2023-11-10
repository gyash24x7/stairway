import type {
	CardMapping,
	CardMappingData,
	CardsData,
	GameData,
	GameStatus,
	HandData,
	Inference,
	Player,
	RawGameData,
	TeamWithMembers
} from "@literature/types";
import { getPlayingCardFromId, SORTED_DECK } from "@s2h/cards";

export function buildCardsData( cardMappings: CardMapping[] ): CardsData {
	const mappings: CardMappingData = {};
	const hands: HandData = {};
	cardMappings.forEach( cardMapping => {
		mappings[ cardMapping.cardId ] = cardMapping.playerId;

		if ( !hands[ cardMapping.playerId ] ) {
			hands[ cardMapping.playerId ] = [];
		}

		hands[ cardMapping.playerId ].push( getPlayingCardFromId( cardMapping.cardId ) );
	} );

	return { mappings, hands };
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

	return {
		...data,
		players: playerMap,
		teams: teamMap,
		cardCounts,
		moves: data.moves!,
		status: data.status as GameStatus
	};
}

export function buildDefaultInference( playerIds: string[], teamIds: string[], playerId: string, cards: string[] ) {
	const inference: Omit<Inference, "gameId"> = {
		playerId,
		activeSets: {},
		actualCardLocations: {},
		possibleCardLocations: {},
		inferredCardLocations: {}
	};
	const defaultProbablePlayers = playerIds.filter( player => player !== playerId );

	teamIds.forEach( teamId => {
		inference.activeSets[ teamId ] = [];
	} );

	SORTED_DECK.forEach( card => {
		if ( cards.includes( card.id ) ) {
			inference.actualCardLocations[ card.id ] = playerId;
			inference.possibleCardLocations[ card.id ] = [ playerId ];
		} else {
			inference.possibleCardLocations[ card.id ] = defaultProbablePlayers;
		}
	} );

	return inference;
}