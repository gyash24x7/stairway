import { createId as cuid } from "@paralleldrive/cuid2";
import {
	CallActionData,
	ILiteratureGame,
	ILiteraturePlayer,
	ILiteratureTeam,
	LiteratureGameStatus,
	LiteratureTeam
} from "@s2h/literature/utils";
import { describe, expect, it } from "vitest";
import { LiteratureGame } from "../src/game";
import { IUser } from "@s2h/utils";
import dayjs from "dayjs";
import { CardSet, cardSetMap } from "@s2h/cards";


describe( "Literature Game", () => {
	const gameId = cuid();
	const team1: ILiteratureTeam = { name: "Stairway", score: 0, gameId, members: [] };
	const team2: ILiteratureTeam = { name: "Highway", score: 0, gameId, members: [] };

	const player1: ILiteraturePlayer = {
		id: cuid(),
		name: "Yash Gupta",
		hand: { cards: [] },
		avatar: "",
		team: team1.name
	};
	team1.members.push( player1.id );

	const player2: ILiteraturePlayer = {
		id: cuid(),
		name: "Gupta Yash",
		hand: { cards: [] },
		avatar: "",
		team: team2.name
	};
	team2.members.push( player2.id );

	const player3: ILiteraturePlayer = {
		id: cuid(),
		name: "Yash Gupta 2",
		hand: { cards: [] },
		avatar: "",
		team: team1.name
	};
	team1.members.push( player3.id );

	const player4: ILiteraturePlayer = {
		id: cuid(),
		name: "Gupta Yash 2",
		hand: { cards: [] },
		avatar: "",
		team: team2.name
	};
	team2.members.push( player4.id );

	const user: IUser = {
		id: player1.id,
		name: player1.name,
		avatar: player1.avatar,
		salt: "",
		email: ""
	};

	const gameData: ILiteratureGame = {
		players: {
			[ player1.id ]: player1,
			[ player2.id ]: player2,
			[ player3.id ]: player3,
			[ player4.id ]: player4
		},
		teams: {
			[ team1.name ]: team1,
			[ team2.name ]: team2
		},
		moves: [],
		id: gameId,
		code: "BCDEDIT",
		status: LiteratureGameStatus.IN_PROGRESS,
		playerCount: 4,
		createdBy: player1.id,
		createdTimestamp: dayjs().toISOString(),
		hands: {
			[ player1.id ]: { cards: [] }
		},
		currentTurn: player1.id
	};

	it( "should serialize and deserialize correctly", () => {
		const literatureGame = LiteratureGame.from( gameData );

		const serializedGame = literatureGame.serialize();
		expect( serializedGame[ "id" ] ).toBe( literatureGame.id );

		const deserializedGame = LiteratureGame.from( serializedGame );
		expect( deserializedGame.id ).toBe( literatureGame.id );
	} );

	it( "should be able to generate game code", () => {
		const gameCode = LiteratureGame.generateGameCode();
		expect( gameCode.length ).toBe( 6 );
	} );

	it( "should be able to generate new game data", () => {
		const gameData = LiteratureGame.create( 4, user );
		expect( gameData.code.length ).toBe( 6 );
		expect( gameData.createdBy ).toBe( user.id );
		expect( gameData.playerCount ).toBe( 4 );
	} );

	it( "should be able to check if user already in game", () => {
		const literatureGame = LiteratureGame.from( gameData );
		const isUserInGame = literatureGame.isUserAlreadyInGame( user.id );
		expect( isUserInGame ).toBeTruthy();
	} );

	it( "should be able to add player to game", () => {
		const literatureGame = LiteratureGame.from( { ...gameData, players: {} } );
		literatureGame.addPlayers( player1 );
		expect( Object.keys( literatureGame.players ).length ).toBe( 1 );
		expect( literatureGame.players[ player1.id ] ).toEqual( player1 );
	} );

	it( "should add teams when teams get created", () => {
		const literatureGame = LiteratureGame.from( { ...gameData, teams: {} } );

		expect( Object.keys( literatureGame.teams ).length ).toBe( 0 );
		literatureGame.createTeams( [ team1, team2 ] );

		expect( Object.keys( literatureGame.teams ).length ).toBe( 2 );
		expect( Object.values( literatureGame.teams ) ).toEqual( [ team1, team2 ].map( LiteratureTeam.from ) );
	} );


	it( "should deal cards and get hands", () => {
		const literatureGame = LiteratureGame.from( { ...gameData } );
		literatureGame.createTeams( [ team2, team1 ] );
		literatureGame.dealCards();

		expect( literatureGame.hands[ player1.id ].length ).toBe( 12 );
		expect( literatureGame.hands[ player2.id ].length ).toBe( 12 );
		expect( literatureGame.hands[ player3.id ].length ).toBe( 12 );
		expect( literatureGame.hands[ player4.id ].length ).toBe( 12 );
	} );

	it( "should remove cards of set from hands of all players", () => {
		const literatureGame = LiteratureGame.from( gameData );
		literatureGame.dealCards();

		const card = literatureGame.players[ player1.id ].hand.cards[ 0 ];
		literatureGame.removeCardsOfSet( card.set );

		expect( literatureGame.players[ player1.id ].hand.contains( card ) ).toBeFalsy();
		expect( literatureGame.players[ player2.id ].hand.contains( card ) ).toBeFalsy();
		expect( literatureGame.players[ player3.id ].hand.contains( card ) ).toBeFalsy();
		expect( literatureGame.players[ player4.id ].hand.contains( card ) ).toBeFalsy();
	} );

	it( "should be able to handle ask move when other person has card", () => {
		const literatureGame = LiteratureGame.from( { ...gameData } );
		literatureGame.dealCards();

		const askData = { from: player1.id, by: player2.id, card: literatureGame.hands[ player1.id ].cards[ 0 ] };
		literatureGame.executeMoveAction( { action: "ASK", askData } );

		const lastMove = literatureGame.moves[ 0 ];
		expect( lastMove.actionData.action ).toBe( "ASK" );
		expect( lastMove.actionData.askData ).toEqual( expect.objectContaining( askData ) );

		expect( lastMove.resultData.result ).toBe( "CARD_TRANSFER" );
		expect( lastMove.resultData.success ).toBe( true );
	} );

	it( "should be able to handle ask move when other person doesn't have card", () => {
		const literatureGame = LiteratureGame.from( { ...gameData } );
		literatureGame.dealCards();

		const askData = { from: player1.id, by: player2.id, card: literatureGame.hands[ player2.id ].cards[ 0 ] };
		literatureGame.executeMoveAction( { action: "ASK", askData } );

		const lastMove = literatureGame.moves[ 0 ];
		expect( lastMove.actionData.action ).toBe( "ASK" );
		expect( lastMove.actionData.askData ).toEqual( expect.objectContaining( askData ) );

		expect( lastMove.resultData.result ).toBe( "CARD_TRANSFER" );
		expect( lastMove.resultData.success ).toBe( false );
	} );

	it( "should be able to transfer chance to specified player", () => {
		const literatureGame = LiteratureGame.from( { ...gameData } );
		literatureGame.dealCards();

		const transferData = { playerId: player1.id };
		literatureGame.executeMoveAction( { action: "CHANCE_TRANSFER", transferData } );

		const lastMove = literatureGame.moves[ 0 ];
		expect( lastMove.actionData.action ).toBe( "CHANCE_TRANSFER" );
		expect( lastMove.actionData.transferData ).toEqual( expect.objectContaining( transferData ) );

		expect( lastMove.resultData.success ).toBeTruthy();
		expect( lastMove.resultData.result ).toBe( "CHANCE_TRANSFER" );
	} );

	it( "should be able to handle call set when the player calls incorrectly", () => {
		const literatureGame = LiteratureGame.from( { ...gameData } );
		const clubsSet = cardSetMap[ CardSet.SMALL_CLUBS ];

		literatureGame.dealCards();
		literatureGame.removeCardsOfSet( CardSet.SMALL_CLUBS );
		literatureGame.addCardsToPlayer( player2.id, ...clubsSet.slice( 0, 3 ) );
		literatureGame.addCardsToPlayer( player4.id, ...clubsSet.slice( 4 ) );
		literatureGame.addCardsToPlayer( player1.id, clubsSet[ 3 ] );

		const callData: CallActionData = {
			set: CardSet.SMALL_CLUBS,
			playerId: player2.id,
			data: {
				[ player2.id ]: clubsSet.slice( 0, 3 ),
				[ player4.id ]: clubsSet.slice( 3 )
			}
		};

		literatureGame.executeMoveAction( { action: "CALL_SET", callData } );

		const lastMove = literatureGame.moves[ 0 ];
		expect( lastMove.actionData.action ).toBe( "CALL_SET" );
		expect( lastMove.actionData.callData?.set ).toBe( CardSet.SMALL_CLUBS );

		expect( lastMove.resultData.result ).toBe( "CALL_SET" );
		expect( lastMove.resultData.success ).toBeFalsy();
		expect( literatureGame.teams[ team1.name ].score ).toBe( 1 );
	} );

	it( "should be able to handle call set when the player calls correctly", () => {
		const literatureGame = LiteratureGame.from( { ...gameData } );
		const clubsSet = cardSetMap[ CardSet.SMALL_CLUBS ];

		literatureGame.dealCards();
		literatureGame.removeCardsOfSet( CardSet.SMALL_CLUBS );
		literatureGame.addCardsToPlayer( player2.id, ...clubsSet.slice( 0, 4 ) );
		literatureGame.addCardsToPlayer( player4.id, ...clubsSet.slice( 4 ) );

		const callData: CallActionData = {
			set: CardSet.SMALL_CLUBS,
			playerId: player2.id,
			data: {
				[ player2.id ]: clubsSet.slice( 0, 4 ),
				[ player4.id ]: clubsSet.slice( 4 )
			}
		};

		literatureGame.executeMoveAction( { action: "CALL_SET", callData } );

		const lastMove = literatureGame.moves[ 0 ];
		expect( lastMove.actionData.action ).toBe( "CALL_SET" );
		expect( lastMove.actionData.callData?.set ).toBe( CardSet.SMALL_CLUBS );

		expect( lastMove.resultData.result ).toBe( "CALL_SET" );
		expect( lastMove.resultData.success ).toBeTruthy();
		expect( literatureGame.teams[ team2.name ].score ).toBe( 1 );
	} );

	it( "should be able to handle call set when the player has all cards", () => {
		const literatureGame = LiteratureGame.from( { ...gameData } );
		const clubsSet = cardSetMap[ CardSet.SMALL_CLUBS ];

		literatureGame.dealCards();
		literatureGame.removeCardsOfSet( CardSet.SMALL_CLUBS );
		literatureGame.addCardsToPlayer( player2.id, ...clubsSet );

		const callData: CallActionData = {
			set: CardSet.SMALL_CLUBS,
			playerId: player2.id,
			data: { [ player2.id ]: clubsSet }
		};

		literatureGame.executeMoveAction( { action: "CALL_SET", callData } );

		const lastMove = literatureGame.moves[ 0 ];
		expect( lastMove.actionData.action ).toBe( "CALL_SET" );
		expect( lastMove.actionData.callData?.set ).toBe( CardSet.SMALL_CLUBS );

		expect( lastMove.resultData.result ).toBe( "CALL_SET" );
		expect( lastMove.resultData.success ).toBeTruthy();
		expect( literatureGame.teams[ team2.name ].score ).toBe( 1 );
	} );

} );