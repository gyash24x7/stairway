import type { Player } from "@literature/data";
import {
	AggregatedGameData,
	AskCardInput,
	CallSetInput,
	CardMapping,
	GameStatus,
	Move,
	MoveType,
	Team,
	TransferChanceInput
} from "@literature/data";
import type { UserAuthInfo } from "@auth/data";
import { CardRank, CardSet, removeCardsOfRank, shuffle, SORTED_DECK } from "@s2h/cards";
import { areTeamsCreated, buildCardMappingsAndHandMap, isGameStarted } from "../../src/utils";

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
	teamId: "1"
};

export const mockPlayer2: Player = {
	id: "2",
	name: "Jane Doe",
	avatar: "https://avatar.com/jane",
	gameId: "1",
	teamId: "2"
};

export const mockPlayer3: Player = {
	id: "3",
	name: "Tom Doe",
	avatar: "https://avatar.com/tom",
	gameId: "1",
	teamId: "1"
};

export const mockPlayer4: Player = {
	id: "4",
	name: "Jerry Doe",
	avatar: "https://avatar.com/jerry",
	gameId: "1",
	teamId: "2"
};

export const mockPlayerIds = [ mockPlayer1.id, mockPlayer2.id, mockPlayer3.id, mockPlayer4.id ];

export const mockTeamA: Team = { id: "1", name: "Team A", gameId: "1", setsWon: [], score: 0 };

export const mockTeamB: Team = { id: "2", name: "Team B", gameId: "1", setsWon: [], score: 0 };

export const deck = removeCardsOfRank( shuffle( SORTED_DECK ), CardRank.SEVEN );

export function buildMockAggregatedGameData(
	status: GameStatus,
	cardMappingList: CardMapping[] = [],
	moves: Move[] = []
): AggregatedGameData {

	if ( isGameStarted( status ) && cardMappingList.length === 0 ) {
		cardMappingList = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );
	}

	const { cardMappingMap, handMap } = buildCardMappingsAndHandMap( cardMappingList );

	const playerList = areTeamsCreated( status )
		? [ mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 ]
		: [
			{ ...mockPlayer1, teamId: null },
			{ ...mockPlayer2, teamId: null },
			{ ...mockPlayer3, teamId: null },
			{ ...mockPlayer4, teamId: null }
		];

	return {
		id: "1",
		status,
		playerCount: 4,
		playerList,
		teamList: areTeamsCreated( status ) ? [ mockTeamA, mockTeamB ] : [],
		teams: areTeamsCreated( status )
			? { [ mockTeamA.id ]: mockTeamA, [ mockTeamB.id ]: mockTeamB }
			: {},
		players: {
			[ mockPlayer1.id ]: playerList[ 0 ],
			[ mockPlayer2.id ]: playerList[ 1 ],
			[ mockPlayer3.id ]: playerList[ 2 ],
			[ mockPlayer4.id ]: playerList[ 3 ]
		},
		code: "123456",
		currentTurn: "1",
		cardMappings: isGameStarted( status ) ? cardMappingMap : {},
		moves: isGameStarted( status ) ? moves : [],
		hands: isGameStarted( status ) ? handMap : {}
	};
}

export const mockAskCardInput: AskCardInput = {
	askedFrom: "2",
	askedFor: "AceOfSpades"
};

export const mockAskMove: Move = {
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

export const mockCallMove: Move = {
	id: "1",
	type: MoveType.CALL_SET,
	gameId: "1",
	success: true,
	data: {
		by: mockPlayer1.id,
		cardSet: CardSet.LOWER_CLUBS,
		actualCall: {},
		correctCall: {}
	},
	description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } correctly!`,
	timestamp: new Date()
};

export const mockTransferChanceInput: TransferChanceInput = {
	transferTo: "3"
};

export const mockTransferMove: Move = {
	id: "2",
	type: MoveType.TRANSFER_CHANCE,
	gameId: "1",
	success: true,
	data: {
		to: mockPlayer3.id,
		from: mockPlayer1.id
	},
	description: `${ mockPlayer1.name } transferred the chance to ${ mockPlayer3.name }`,
	timestamp: new Date()
};