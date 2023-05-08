import { LitGame, LitGameStatus, LitMove, LitMoveType, LitPlayer, LitTeam, User } from "@prisma/client";
import { CardRank, CardSet, CardSuit, PlayingCard } from "@s2h/cards";
import { EnhancedLitPlayer, EnhancedLitTeam } from "@s2h/literature/utils";
import { createId as cuid } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";
import { EnhancedLitGame } from "../src/enhanced-game";

type LitGameData = LitGame & { players: LitPlayer[], moves: LitMove[], teams: LitTeam[] }

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

	const user: User = {
		id: player1.userId,
		name: player1.name,
		avatar: player1.avatar,
		salt: "",
		email: ""
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

	const baseLitMove = {
		id: cuid(),
		type: LitMoveType.TURN,
		askedFor: null,
		turnId: null,
		askedFromId: null,
		askedById: null,
		createdAt: new Date()
	};

	const move1: LitMove = {
		...baseLitMove,
		type: LitMoveType.TURN,
		description: "",
		gameId: gameData.id,
		createdAt: new Date( 12324 )
	};

	gameData.moves = [ move1 ];

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

		const enhancedMyTeam = EnhancedLitTeam.from( team1 );
		enhancedMyTeam.addMembers( deserializedGame.players );
		expect( deserializedGame.myTeam ).toEqual( enhancedMyTeam );

		const enhancedOppositeTeam = EnhancedLitTeam.from( team2 );
		enhancedOppositeTeam.addMembers( deserializedGame.players );
		expect( deserializedGame.oppositeTeam ).toEqual( enhancedOppositeTeam );
	} );

	it( "should be able to generate game code", function () {
		const gameCode = EnhancedLitGame.generateGameCode();
		expect( gameCode.length ).toBe( 6 );
	} );

	it( "should be able to generate new game data", function () {
		const gameData = EnhancedLitGame.generateNewGameData( { playerCount: 4, createdBy: user } );
		expect( gameData.code.length ).toBe( 6 );
		expect( gameData.createdById ).toBe( user.id );
		expect( gameData.playerCount ).toBe( 4 );
	} );

	it( "should be able to check if user already in game", function () {
		const enhancedLitGame = EnhancedLitGame.from( gameData );
		const isUserInGame = enhancedLitGame.isUserAlreadyInGame( user );
		expect( isUserInGame ).toBeTruthy();
	} );

	it( "should be able to add player to game", function () {
		const enhancedLitGame = EnhancedLitGame.from( { ...gameData, players: [] } );
		enhancedLitGame.addPlayer( player1 );
		expect( enhancedLitGame.players.length ).toBe( 1 );
		expect( enhancedLitGame.players[ 0 ] ).toEqual( player1 );
	} );

	it( "should add teams when teams get created", function () {
		const enhancedLitGame = EnhancedLitGame.from( { ...gameData, teams: [] } );

		expect( enhancedLitGame.teams.length ).toBe( 0 );
		enhancedLitGame.addTeams( [ team1, team2 ] );

		expect( enhancedLitGame.teams.length ).toBe( 2 );
		expect( enhancedLitGame.teams ).toEqual( [ team1, team2 ].map( EnhancedLitTeam.from ) );
	} );

	it( "should be able to generate data for new player", function () {
		const enhancedLitGame = EnhancedLitGame.from( gameData );
		const playerData = enhancedLitGame.generateNewPlayerData( user );

		expect( playerData.gameId ).toBe( enhancedLitGame.id );
		expect( playerData.name ).toBe( user.name );
	} );

	it( "should deal cards and get hands", function () {
		const enhancedLitGame = EnhancedLitGame.from( { ...gameData, teams: [ team2, team1 ] } );

		const handData = enhancedLitGame.dealCardsAndGetHands();

		expect( handData[ player1.id ].length ).toBe( 24 );
		expect( handData[ player2.id ].length ).toBe( 24 );
	} );

	it( "should add moves to the game when new move gets created", function () {
		const enhancedLitGame = EnhancedLitGame.from( gameData );

		expect( enhancedLitGame.moves.length ).toBe( 1 );

		const move2: LitMove = {
			...baseLitMove,
			...enhancedLitGame.getNewMoveData( {
				type: LitMoveType.ASK,
				askedBy: EnhancedLitPlayer.from( player1 ),
				askedFor: twoOfClubs,
				askedFrom: EnhancedLitPlayer.from( player2 )
			} )
		};

		const move3: LitMove = {
			...baseLitMove,
			...enhancedLitGame.getNewMoveData( {
				type: LitMoveType.GIVEN,
				givingPlayer: EnhancedLitPlayer.from( player1 ),
				card: twoOfClubs,
				takingPlayer: EnhancedLitPlayer.from( player2 )
			} )
		};

		const move4: LitMove = {
			...baseLitMove,
			...enhancedLitGame.getNewMoveData( {
				type: LitMoveType.DECLINED,
				askingPlayer: EnhancedLitPlayer.from( player1 ),
				card: twoOfClubs,
				declinedPlayer: EnhancedLitPlayer.from( player2 )
			} )
		};

		const move5: LitMove = {
			...baseLitMove,
			...enhancedLitGame.getNewMoveData( {
				type: LitMoveType.CALL_FAIL,
				turnPlayer: EnhancedLitPlayer.from( player1 ),
				cardSet: CardSet.SMALL_HEARTS,
				callingPlayer: EnhancedLitPlayer.from( player2 )
			} )
		};

		const move6: LitMove = {
			...baseLitMove,
			...enhancedLitGame.getNewMoveData( {
				type: LitMoveType.CALL_SUCCESS,
				turnPlayer: EnhancedLitPlayer.from( player1 ),
				cardSet: CardSet.SMALL_HEARTS
			} )
		};

		enhancedLitGame.addMove( move2 );
		expect( enhancedLitGame.moves.length ).toBe( 2 );
		expect( enhancedLitGame.moves[ 0 ].id ).toBe( move2.id );

		enhancedLitGame.addMove( move3 );
		expect( enhancedLitGame.moves.length ).toBe( 3 );
		expect( enhancedLitGame.moves[ 0 ].id ).toBe( move3.id );

		enhancedLitGame.addMove( move4 );
		expect( enhancedLitGame.moves.length ).toBe( 4 );
		expect( enhancedLitGame.moves[ 0 ].id ).toBe( move4.id );

		enhancedLitGame.addMove( move5 );
		expect( enhancedLitGame.moves.length ).toBe( 5 );
		expect( enhancedLitGame.moves[ 0 ].id ).toBe( move5.id );

		enhancedLitGame.addMove( move6 );
		expect( enhancedLitGame.moves.length ).toBe( 6 );
		expect( enhancedLitGame.moves[ 0 ].id ).toBe( move6.id );
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