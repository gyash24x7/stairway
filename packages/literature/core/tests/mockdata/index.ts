import type { UserAuthInfo } from "@auth/types";
import type {
	AskMove,
	CallMove,
	GameData,
	Inference,
	Player,
	PlayerSpecificData,
	RawGameData,
	TransferMove
} from "@literature/types";
import {
	AskCardInput,
	CallSetInput,
	CardMapping,
	GameStatus,
	Move,
	MoveType,
	Team,
	TransferTurnInput
} from "@literature/types";
import {
	CardRank,
	CardSet,
	getCardSetsInHand,
	getPlayingCardFromId,
	removeCardsOfRank,
	shuffle,
	SORTED_DECK
} from "@s2h/cards";
import { buildDefaultInference, buildGameData } from "../../src/utils";

function areTeamsCreated( status: GameStatus ) {
	return status === GameStatus.TEAMS_CREATED || status === GameStatus.IN_PROGRESS || status === GameStatus.COMPLETED;
}

function isGameStarted( status: GameStatus ) {
	return status === GameStatus.IN_PROGRESS || status === GameStatus.COMPLETED;
}

export const mockAuthInfo: UserAuthInfo = {
	id: "1",
	name: "John Doe",
	email: "john@doe.com",
	avatar: "https://avatar.com/john",
	verified: true
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

export const mockTeamA: Team = { id: "1", name: "Team A", gameId: "1", setsWon: [], score: 0 };

export const mockTeamB: Team = { id: "2", name: "Team B", gameId: "1", setsWon: [], score: 0 };

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
	type: MoveType.ASK_CARD,
	gameId: "1",
	success: true,
	data: {
		from: mockAskCardInput.askedFrom,
		by: mockAuthInfo.id,
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
	type: MoveType.CALL_SET,
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
	type: MoveType.TRANSFER_TURN,
	gameId: "1",
	success: true,
	data: {
		to: mockPlayer3.id,
		from: mockPlayer1.id
	},
	description: `${ mockPlayer1.name } transferred the turn to ${ mockPlayer3.name }`,
	timestamp: new Date()
};