import { LitGameStatus, LitPlayer, LitTeam } from "@prisma/client";
import cuid from "cuid";
import { CardRank, CardSuit, PlayingCard } from "@s2h/cards";
import gameObject from "./game-object.json";
import type { LitGameData } from "@s2h/utils";
import { EnhancedLitGame } from "../src/lit-game";

describe( "Enhanced Lit Game", function () {
	const gameId = cuid();
	const team1: LitTeam = { id: cuid(), name: "Stairway", score: 0, gameId };
	const team2: LitTeam = { id: cuid(), name: "Highway", score: 0, gameId };

	const twoOfClubs = new PlayingCard( CardRank.TWO, CardSuit.CLUBS );
	const fourOfHearts = new PlayingCard( CardRank.FOUR, CardSuit.HEARTS );

	const player1: LitPlayer = {
		id: cuid(),
		name: "Yash Gupta",
		gameId,
		hand: { cards: [ twoOfClubs.serialize() ] },
		avatar: "",
		userId: cuid(),
		teamId: team1.id
	};

	const player2: LitPlayer = {
		id: cuid(),
		name: "Gupta Yash",
		gameId,
		hand: { cards: [ fourOfHearts.serialize() ] },
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

	it( "should serialize to plain json", function () {
		const enhancedLitGame = new EnhancedLitGame( gameData );
		const serializedData = enhancedLitGame.serialize();

		expect( serializedData[ "loggedInPlayer" ] ).toBeUndefined();
		expect( serializedData[ "playerData" ] ).toBeUndefined();
		expect( serializedData[ "teamData" ] ).toBeUndefined();
		expect( serializedData[ "loggedInUserId" ] ).toBeUndefined();
		expect( serializedData[ "askableCardSets" ] ).toBeUndefined();
		expect( serializedData[ "callableCardSets" ] ).toBeUndefined();
		expect( serializedData[ "myTeam" ] ).toBeUndefined();
		expect( serializedData[ "oppositeTeam" ] ).toBeUndefined();

	} );

	it( "should create from plain json", function () {
		const enhancedLitGame = EnhancedLitGame.from( gameObject );

		expect( enhancedLitGame.players.length ).toBe( 2 );
		expect( enhancedLitGame.teams.length ).toBe( 2 );

		expect( enhancedLitGame.playerData ).toEqual( { [ player1.id ]: player1, [ player2.id ]: player2 } );
		expect( enhancedLitGame.teamData ).toEqual( { [ team2.id ]: team2, [ team1.id ]: team1 } )

	} );
} );