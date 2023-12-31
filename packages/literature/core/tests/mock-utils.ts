import {
	CardRank,
	CardSet,
	getCardSetsInHand,
	getPlayingCardFromId,
	removeCardsOfRank,
	shuffle,
	SORTED_DECK
} from "@common/cards";
import type {
	AskCardInput,
	AskMove,
	CallMove,
	CallSetInput,
	CardMapping,
	CardMappingData,
	CardsData,
	GameData,
	GameStatus,
	HandData,
	Inference,
	Move,
	Player,
	PlayerSpecificData,
	RawGameData,
	Team,
	TransferMove,
	TransferTurnInput,
	User
} from "@literature/types";

function areTeamsCreated( status: GameStatus ) {
	return status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED";
}

function isGameStarted( status: GameStatus ) {
	return status === "IN_PROGRESS" || status === "COMPLETED";
}

export const mockAuthUser: User = {
	id: "1",
	name: "John Doe",
	email: "john@doe.com",
	avatar: "https://avatar.com/john"
};

export const mockPlayer1: Player = {
	id: "1",
	name: "John Doe",
	avatar: "https://avatar.com/john",
	gameId: "1",
	teamId: "1",
	isBot: false
};

export const mockPlayer2: Player = {
	id: "2",
	name: "Jane Doe",
	avatar: "https://avatar.com/jane",
	gameId: "1",
	teamId: "2",
	isBot: false
};

export const mockPlayer3: Player = {
	id: "3",
	name: "Tom Doe",
	avatar: "https://avatar.com/tom",
	gameId: "1",
	teamId: "1",
	isBot: false
};

export const mockPlayer4: Player = {
	id: "4",
	name: "Jerry Doe",
	avatar: "https://avatar.com/jerry",
	gameId: "1",
	teamId: "2",
	isBot: false
};

export const mockPlayerIds = [ mockPlayer1.id, mockPlayer2.id, mockPlayer3.id, mockPlayer4.id ];

export const mockTeamA: Team = {
	id: "1",
	name: "Team A",
	gameId: "1",
	setsWon: [],
	score: 0,
	memberIds: [ mockPlayer1.id, mockPlayer3.id ]
};

export const mockTeamB: Team = {
	id: "2",
	name: "Team B",
	gameId: "1",
	setsWon: [],
	score: 0,
	memberIds: [ mockPlayer2.id, mockPlayer4.id ]
};

export const mockTeamIds = [ mockTeamA.id, mockTeamB.id ];

export const deck = removeCardsOfRank( shuffle( SORTED_DECK ), CardRank.SEVEN );

export function buildMockRawGameData(
	status: GameStatus,
	cardMappings: CardMapping[] = [],
	moves: Move[] = []
): RawGameData {

	const teams = areTeamsCreated( status ) ? [ mockTeamA, mockTeamB ] : [];

	if ( isGameStarted( status ) && cardMappings.length === 0 ) {
		cardMappings = buildMockCardMappings();
	}

	let players: Player[] = [ mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 ];

	if ( !areTeamsCreated( status ) ) {
		players = [
			{ ...mockPlayer1, teamId: null },
			{ ...mockPlayer2, teamId: null },
			{ ...mockPlayer3, teamId: null },
			{ ...mockPlayer4, teamId: null }
		];
	}

	return {
		id: "1",
		status,
		playerCount: 4,
		code: "123456",
		currentTurn: "1",
		players,
		teams,
		cardMappings,
		moves: isGameStarted( status ) ? moves : []
	};
}

export function buildMockInferenceData( gameId: string, cardMappingList: CardMapping[] = [] ) {
	const inferenceData: Record<string, Inference> = {};
	mockPlayerIds.forEach( playerId => {
		const hand = cardMappingList.filter( cardMapping => cardMapping.playerId === playerId )
			.map( cardMapping => cardMapping.cardId );
		inferenceData[ playerId ] = { gameId, ...buildDefaultInference( mockPlayerIds, mockTeamIds, playerId, hand ) };
	} );

	return inferenceData;
}

export function buildMockCardMappings() {
	return deck.map( ( card, index ) => (
		{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
	) );
}

export function buildPlayerSpecificData( player: Player, cardMappingList: CardMapping[] ): PlayerSpecificData {
	const hand = cardMappingList.filter( cardMapping => cardMapping.playerId === player.id )
		.map( cardMapping => getPlayingCardFromId( cardMapping.cardId ) );

	const cardSets = getCardSetsInHand( hand );

	return { ...player, hand, cardSets };
}

export function buildMockGameData(
	status: GameStatus,
	cardMappings: CardMapping[] = [],
	moves: Move[] = []
): GameData {
	return buildGameData( buildMockRawGameData( status, cardMappings, moves ) );
}

export const mockAskCardInput: AskCardInput = {
	askedFrom: "2",
	askedFor: "AceOfSpades"
};

export const mockAskMove: AskMove = {
	id: "1",
	type: "ASK_CARD",
	gameId: "1",
	success: true,
	data: {
		from: mockAskCardInput.askedFrom,
		by: mockAuthUser.id,
		card: mockAskCardInput.askedFor
	},
	description: `${ mockPlayer1.name } asked ${ mockPlayer2.name } for ${ mockAskCardInput.askedFor } and got the card!`,
	timestamp: new Date()
};

export const mockCallSetInput: CallSetInput = {
	data: {
		AceOfClubs: "1",
		TwoOfClubs: "1",
		ThreeOfClubs: "1",
		FourOfClubs: "3",
		FiveOfClubs: "3",
		SixOfClubs: "3"
	}
};

export const mockCallMove: CallMove = {
	id: "1",
	type: "CALL_SET",
	gameId: "1",
	success: true,
	data: {
		by: mockPlayer1.id,
		cardSet: CardSet.LOWER_CLUBS,
		actualCall: mockCallSetInput.data,
		correctCall: mockCallSetInput.data
	},
	description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } correctly!`,
	timestamp: new Date()
};

export const mockTransferTurnInput: TransferTurnInput = {
	transferTo: "3"
};

export const mockTransferMove: TransferMove = {
	id: "2",
	type: "TRANSFER_TURN",
	gameId: "1",
	success: true,
	data: {
		to: mockPlayer3.id,
		from: mockPlayer1.id
	},
	description: `${ mockPlayer1.name } transferred the turn to ${ mockPlayer3.name }`,
	timestamp: new Date()
};

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
	const teamMap: Record<string, Team> = {};
	data.teams?.forEach( team => {
		teamMap[ team.id ] = { ...team, memberIds: [] };
	} );

	const playerMap: Record<string, Player> = {};
	data.players.forEach( player => {
		playerMap[ player.id ] = player;
		if ( !!player.teamId ) {
			teamMap[ player.teamId ]?.memberIds.push( player.id );
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