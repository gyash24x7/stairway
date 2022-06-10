import { LitGameStatus, LitMove, LitMoveType, LitPlayer, LitTeam } from "@prisma/client";
import cuid from "cuid";
import { CardRank, CardSet, CardSuit, PlayingCard } from "@s2h/cards";
import type { LitGameData } from "@s2h/utils";
import { EnhancedLitGame } from "../src/enhanced-game";
import { EnhancedLitPlayer, EnhancedLitTeam } from "@s2h/literature/utils";

describe( "Enhanced Lit Game", function () {
	const gameId = cuid();
	const team1: LitTeam = { id: cuid(), name: "Stairway", score: 0, gameId };
	const team2: LitTeam = { id: cuid(), name: "Highway", score: 0, gameId };

	const twoOfClubs = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.CLUBS } );
	const fourOfHearts = PlayingCard.from( { rank: CardRank.FOUR, suit: CardSuit.HEARTS } );

	const player1: LitPlayer = {
		id: cuid(),
		name: "Yash Gupta",
		gameId,
		hand: { cards: [ JSON.parse( JSON.stringify( twoOfClubs ) ) ] },
		avatar: "",
		userId: cuid(),
		teamId: team1.id
	};

	const player2: LitPlayer = {
		id: cuid(),
		name: "Gupta Yash",
		gameId,
		hand: { cards: [ JSON.parse( JSON.stringify( fourOfHearts ) ) ] },
		avatar: "",
		userId: cuid(),
		teamId: team2.id
	};

	const gameData: LitGameData = {
		players: [ player1, player2 ],
		teams: [ team1, team2 ],
		moves: [],
		id: gameId,
		code: "BCDEDIT",
		status: LitGameStatus.IN_PROGRESS,
		playerCount: 2,
		createdById: player1.userId,
		createdAt: new Date(),
		updatedAt: new Date()
	};

	it( "should serialize and deserialize correctly", function () {
		const enhancedLitGame = EnhancedLitGame.from( gameData );
		const serializedGame = JSON.parse( JSON.stringify( enhancedLitGame ) );

		expect( serializedGame[ "loggedInPlayer" ] ).toBeUndefined();
		expect( serializedGame[ "loggedInUserId" ] ).toBeUndefined();
		expect( serializedGame[ "askableCardSets" ] ).toBeUndefined();
		expect( serializedGame[ "callableCardSets" ] ).toBeUndefined();
		expect( serializedGame[ "myTeam" ] ).toBeUndefined();
		expect( serializedGame[ "oppositeTeam" ] ).toBeUndefined();

		const deserializedGame = new EnhancedLitGame( serializedGame );

		expect( deserializedGame.loggedInPlayer ).toBeUndefined();
		expect( deserializedGame.loggedInUserId ).toBeUndefined();
		expect( deserializedGame.askableCardSets.length ).toBe( 0 );
		expect( deserializedGame.callableCardSets.length ).toBe( 0 );
		expect( deserializedGame.myTeam ).toBeNull();
		expect( deserializedGame.oppositeTeam ).toBeNull();

		deserializedGame.loggedInUserId = player1.userId;

		expect( deserializedGame.loggedInPlayer ).toEqual( player1 );
		expect( deserializedGame.loggedInUserId ).toBe( player1.userId );
		expect( deserializedGame.askableCardSets.length ).toBeGreaterThan( 0 );
		expect( deserializedGame.callableCardSets.length ).toBeGreaterThan( 0 );
		expect( deserializedGame.myTeam ).toEqual( EnhancedLitTeam.from( team1, deserializedGame.players ) );
		expect( deserializedGame.oppositeTeam ).toEqual( EnhancedLitTeam.from( team2, deserializedGame.players ) );
	} );

	it( "should add teams when teams get created", function () {
		const enhancedLitGame = EnhancedLitGame.from( { ...gameData, teams: [] } );

		expect( enhancedLitGame.teams.length ).toBe( 0 );

		const playerGroups = [ [ EnhancedLitPlayer.from( player1 ) ], [ EnhancedLitPlayer.from( player2 ) ] ];
		enhancedLitGame.addTeams( [ team1, team2 ], playerGroups );

		expect( enhancedLitGame.teams.length ).toBe( 2 );
		expect( enhancedLitGame.teams[ 0 ].members ).toEqual( playerGroups[ 0 ] );
		expect( enhancedLitGame.teams[ 1 ].members ).toEqual( playerGroups[ 1 ] );
	} );

	it( "should deal cards and get hands", function () {
		const enhancedLitGame = EnhancedLitGame.from( gameData );

		const handData = enhancedLitGame.dealCardsAndGetHands();

		expect( handData[ player1.id ].length ).toBe( 24 );
		expect( handData[ player2.id ].length ).toBe( 24 );
	} );

	it( "should add moves to the game when new move gets created", function () {
		const enhancedLitGame = EnhancedLitGame.from( gameData );

		expect( enhancedLitGame.moves.length ).toBe( 0 );

		const move1: LitMove = {
			id: cuid(),
			description: "Move 1",
			gameId: enhancedLitGame.id,
			type: LitMoveType.TURN,
			askedFor: null,
			callingSet: null,
			turnId: player1.id,
			askedFromId: null,
			askedById: null,
			createdAt: new Date()
		};

		const move2: LitMove = {
			id: cuid(),
			description: "Move 2",
			gameId: enhancedLitGame.id,
			type: LitMoveType.TURN,
			askedFor: null,
			callingSet: null,
			turnId: player1.id,
			askedFromId: null,
			askedById: null,
			createdAt: new Date()
		};

		enhancedLitGame.addMove( move1 );
		expect( enhancedLitGame.moves.length ).toBe( 1 );
		expect( enhancedLitGame.moves[ 0 ].id ).toBe( move1.id );

		enhancedLitGame.addMove( move2 );
		expect( enhancedLitGame.moves.length ).toBe( 2 );
		expect( enhancedLitGame.moves[ 0 ].id ).toBe( move2.id );
	} );

	it( "should handle player update and also update team members", function () {
		const enhancedLitGame = EnhancedLitGame.from( gameData );

		enhancedLitGame.handlePlayerUpdate( { ...player1, name: "Yash Gupta Updated" } );

		expect( enhancedLitGame.playerData[ player1.id ].name ).toBe( "Yash Gupta Updated" );
		expect( enhancedLitGame.teamData[ player1.teamId! ].members[ 0 ].name ).toBe( "Yash Gupta Updated" );
	} );

	it( "should handle team update", function () {
		const enhancedLitGame = EnhancedLitGame.from( gameData );
		enhancedLitGame.handleTeamUpdate( { ...team1, name: "Stairway Updated" } );
		expect( enhancedLitGame.teamData[ team1.id ].name ).toBe( "Stairway Updated" );
	} );

	it( "should remove cards of set from hands of all players", function () {
		const enhancedLitGame = EnhancedLitGame.from( gameData );

		expect( enhancedLitGame.playerData[ player2.id ].hand.length ).toBe( 1 );
		expect( enhancedLitGame.playerData[ player2.id ].hand.contains( fourOfHearts ) ).toBeTruthy();

		const handData = enhancedLitGame.removeCardsOfSetFromGameAndGetUpdatedHands( CardSet.SMALL_HEARTS );

		expect( enhancedLitGame.playerData[ player2.id ].hand.length ).toBe( 0 );
		expect( enhancedLitGame.playerData[ player2.id ].hand.contains( fourOfHearts ) ).toBeFalsy();

		expect( handData[ player2.id ].length ).toBe( 0 );
	} );

} );