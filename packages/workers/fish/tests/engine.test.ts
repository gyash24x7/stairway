import { chunk } from "@s2h/utils/array";
import type { CardId } from "@s2h/utils/cards";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FishEngine } from "../src/engine.ts";
import type { AskEvent, BasePlayerInfo, Bindings, Book, ClaimEvent, GameData, PlayerId, TeamId } from "../src/types.ts";
import { getCardsOfBook } from "../src/utils.ts";

vi.mock( "cloudflare:workers", () => ( {
	DurableObject: class {
		constructor( public ctx: DurableObjectState, public env: Bindings ) { }
	}
} ) );

class MockFishEngine extends FishEngine {
	public get id() {
		return this.data.id;
	}

	public setHands( hands: CardId[][] ) {
		this.data.hands = this.data.playerIds.reduce(
			( acc, playerId, idx ) => {
				acc[ playerId ] = hands[ idx ];
				this.data.cardCounts[ playerId ] = hands[ idx ].length;
				hands[ idx ].forEach( card => {
					this.data.cardMappings[ card ] = playerId;
				} );
				return acc;
			},
			{} as Record<PlayerId, CardId[]>
		);
	}

	public setHand( playerId: PlayerId, hand: CardId[] ) {
		this.data.hands[ playerId ].forEach( cardId => {
			delete this.data.cardMappings[ cardId ];
		} );

		this.data.hands[ playerId ] = hand;
		this.data.cardCounts[ playerId ] = hand.length;
		hand.forEach( card => {
			this.data.cardMappings[ card ] = playerId;
		} );
	}

	public updatePlayers( players: Record<PlayerId, BasePlayerInfo & { isBot?: boolean }> ) {
		this.data.players = {};
		this.data.playerIds = Object.keys( players );

		for ( const playerId of this.data.playerIds ) {
			this.data.players[ playerId ] = {
				...players[ playerId ],
				teamId: "",
				teamMates: [],
				opponents: [],
				isBot: players[ playerId ].isBot || false
			};

			this.data.metrics[ playerId ] = {
				cardsGiven: 0,
				cardsTaken: 0,
				successfulClaims: 0,
				totalAsks: 0,
				totalClaims: 0
			};
		}
	}

	public updateTeams() {
		this.data.teams = {};
		this.data.teamIds = [ "t1", "t2" ];
		const { t1, t2 } = this.getMockTeamStructure();
		this.data.teams[ "t1" ] = { id: "t1", name: "t1", players: t1, score: 0, booksWon: [] };
		this.data.teams[ "t2" ] = { id: "t2", name: "t2", players: t2, score: 0, booksWon: [] };

		t1.forEach( pid => {
			this.data.players[ pid ].teamId = "t1";
			this.data.players[ pid ].teamMates = t1.filter( p => p !== pid );
			this.data.players[ pid ].opponents = t2;
		} );

		t2.forEach( pid => {
			this.data.players[ pid ].teamId = "t2";
			this.data.players[ pid ].teamMates = t2.filter( p => p !== pid );
			this.data.players[ pid ].opponents = t1;
		} );
	}

	public getMockTeamStructure() {
		const [ t1Players, t2Players ] = chunk( this.data.playerIds, this.data.playerIds.length / 2 );
		return { t1: t1Players, t2: t2Players };
	}

	public getGameData() {
		return this.data;
	}

	public setLastMove( move: AskEvent | ClaimEvent ) {
		const isAsk = "cardId" in move;
		this.data.lastMoveType = isAsk ? "ask" : "claim";
		if ( isAsk ) {
			this.data.askHistory.unshift( move );
		} else {
			this.data.claimHistory.unshift( move );
		}
	}

	public resetMoveHistory() {
		this.data.askHistory = [];
		this.data.claimHistory = [];
		this.data.transferHistory = [];
		this.data.lastMoveType = "claim";
	}

	public setScores( data: Record<TeamId, Book[]> ) {
		for ( const teamId of this.data.teamIds ) {
			this.data.teams[ teamId ].booksWon = data[ teamId ];
			this.data.teams[ teamId ].score = data[ teamId ].length;

			data[ teamId ].forEach( book => {
				const cards = getCardsOfBook( book, this.data.config.type );
				cards.forEach( cardId => {
					delete this.data.cardMappings[ cardId ];
					delete this.data.cardLocations[ cardId ];
				} );
			} );
		}
	}

	public setCardLocations( locations: Partial<Record<CardId, PlayerId[]>> ) {
		for ( const cardId in locations ) {
			this.data.cardLocations[ cardId as CardId ] = locations[ cardId as CardId ];
		}
	}
}

describe( "Fish:Engine", () => {

	const mockDurableObjectState = {
		id: { toString: () => "mock-do-id" },
		blockConcurrencyWhile: async <T>( cb: () => Promise<T> ) => cb(),
		storage: {
			setAlarm: vi.fn(),
			deleteAlarm: vi.fn()
		}
	} as unknown as DurableObjectState;

	const mockWss = {
		broadcast: vi.fn()
	};

	const mockEnv = {
		FISH_KV: {
			get: vi.fn(),
			put: vi.fn()
		},
		WSS: {
			idFromName: vi.fn(),
			get: vi.fn().mockImplementation( () => mockWss )
		}
	};

	const player1 = { id: "p1", name: "Player 1", avatar: "avatar-1", username: "player1" };
	const player2 = { id: "p2", name: "Player 2", avatar: "avatar-2", username: "player2" };
	const player3 = { id: "p3", name: "Player 3", avatar: "avatar-3", username: "player3" };
	const player4 = { id: "p4", name: "Player 4", avatar: "avatar-4", username: "player4" };
	const player5 = { id: "p5", name: "Player 5", avatar: "avatar-5", username: "player5" };
	const player6 = { id: "p6", name: "Player 6", avatar: "avatar-6", username: "player6" };

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "GamePlay: Exception Scenarios", () => {
		const engine = new MockFishEngine( mockDurableObjectState, mockEnv as unknown as Bindings );

		it.sequential( "should return error if trying to initialize with invalid config", async () => {
			expect( mockEnv.FISH_KV.get ).toHaveBeenCalledWith( "mock-do-id", "json" );
			expect( mockEnv.FISH_KV.put ).toHaveBeenCalledWith( "mock-do-id", expect.any( String ) );

			const { error } = await engine.initialize( { playerCount: 4, type: "NORMAL", teamCount: 3 }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Invalid team player combination!" );
		} );

		it.sequential( "should initialize game with default settings", async () => {
			await engine.initialize( { playerCount: 4, type: "NORMAL", teamCount: 2 }, player1 );
			const data = engine.getGameData();

			expect( data.config.type ).toBe( "NORMAL" );
			expect( data.config.playerCount ).toBe( 4 );
			expect( data.config.teamCount ).toBe( 2 );
			expect( data.config.deckType ).toBe( 52 );
		} );

		it.sequential( "should return error if trying to reinitialize a game with players", async () => {
			const { error } = await engine.initialize( { playerCount: 4, type: "NORMAL", teamCount: 2 }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Cannot initialize a game that already has players!" );
		} );

		it.sequential( "should return error if player not part of game", async () => {
			const { error } = await engine.getPlayerData( "invalid-player" );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Player invalid-player is not part of the game!" );
		} );

		it.sequential( "should return game id if player tries to re-join", async () => {
			const { data, error } = await engine.addPlayer( player1 );
			expect( error ).toBeUndefined();
			expect( data ).toBeDefined();
			expect( data ).toEqual( expect.any( String ) );
		} );

		it.sequential( "should return error if non-creator tries to add bots", async () => {
			const { error } = await engine.addBots( player2 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Only the game creator can add bots!" );
		} );

		it.sequential( "should return error when trying to create teams before players ready", async () => {
			const teamData = engine.getMockTeamStructure();
			const { error } = await engine.createTeams( { gameId: "", teams: teamData }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "The Game is not in PLAYERS_READY state!" );
		} );

		it.sequential( "should return error when more than 4 players try to join", async () => {
			await engine.addBots( player1 );
			engine.updatePlayers( { p1: player1, p2: player2, p3: player3, p4: player4 } );

			const extraPlayer = {
				id: "p5",
				name: "Player 5",
				avatar: "avatar-5",
				username: "player5"
			};

			const { error } = await engine.addPlayer( extraPlayer );

			expect( error ).toBeDefined();
			expect( error ).toBe( "Game full!" );
		} );

		it.sequential( "should return error if trying to reinitialize a game not in created state", async () => {
			const { error } = await engine.initialize( { playerCount: 4, type: "NORMAL", teamCount: 2 }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Game has already been initialized!" );
		} );

		it.sequential( "should return error while adding bots when game already has 4 players", async () => {
			const { error } = await engine.addBots( player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Game full!" );
		} );

		it.sequential( "should return error if non-creator tries to create teams", async () => {
			const { error } = await engine.createTeams( { gameId: engine.id, teams: {} }, player2 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Only the game creator can create teams!" );
		} );

		it.sequential( "should return error if team count does not match config", async () => {
			const { error } = await engine.createTeams(
				{ gameId: engine.id, teams: { t1: [], t2: [], t3: [] } },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Team count does not match the game configuration!" );
		} );

		it.sequential( "should return error if not all players assigned teams", async () => {
			const { error } = await engine.createTeams(
				{ gameId: engine.id, teams: { t1: [ "p1" ], t2: [ "p2" ] } },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Not all players are divided into teams!" );
		} );

		it.sequential( "should return error if not all players are distributed unequally", async () => {
			const { error } = await engine.createTeams(
				{ gameId: engine.id, teams: { t1: [ "p1" ], t2: [ "p2", "p3", "p4" ] } },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Invalid number of players in team t1!" );
		} );

		it.sequential( "should return error if unknown players mentioned in team config", async () => {
			const { t1, t2 } = engine.getMockTeamStructure();
			const { error } = await engine.createTeams(
				{ gameId: engine.id, teams: { t1, t2: [ t2[ 0 ], "p5" ] } },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Player p5 is not part of the game!" );
		} );

		it.sequential( "should return when trying to start game before teams are created", async () => {
			const { error } = await engine.startGame( player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "The Game is not in TEAMS_CREATED state!" );
		} );

		it.sequential( "should return error if non-creator tries to start the game", async () => {
			const teamData = engine.getMockTeamStructure();
			await engine.createTeams( { gameId: engine.id, teams: teamData }, player1 );

			engine.updateTeams();

			const { error } = await engine.startGame( player2 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Only the game creator can start the game!" );
		} );

		it.sequential( "should return error if trying to ask a card before game started", async () => {
			const { error } = await engine.askCard(
				{ gameId: engine.id, from: "p2", cardId: "AS" },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "The Game is not in IN_PROGRESS state!" );
		} );

		it.sequential( "should return error if trying to claim a book before game started", async () => {
			const { error } = await engine.claimBook(
				{ gameId: engine.id, claim: { "AH": "p1", "AS": "p2" } },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "The Game is not in IN_PROGRESS state!" );
		} );

		it.sequential( "should return error if trying to transfer turn before game started", async () => {
			const { error } = await engine.transferTurn(
				{ gameId: engine.id, transferTo: "p2" },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "The Game is not in IN_PROGRESS state!" );
		} );

		it.sequential( "should start the game and set the hands", async () => {
			const { error } = await engine.startGame( player1 );
			expect( error ).toBeUndefined();

			const hands: CardId[][] = [
				[ "AH", "10H", "7H", "6H", "AC", "QC", "10C", "5S", "3S", "QD", "10D", "6D", "2D" ],
				[ "KH", "9H", "8H", "JC", "8C", "6C", "JS", "10S", "7S", "4S", "2S", "9D", "3D" ],
				[ "JH", "5H", "KC", "9C", "7C", "AS", "KS", "AD", "KD", "JD", "8D", "7D", "5D" ],
				[ "QH", "4H", "3H", "2H", "5C", "4C", "3C", "2C", "QS", "9S", "8S", "6S", "4D" ]
			];

			const data = engine.getGameData();

			expect( data.status ).toBe( "IN_PROGRESS" );
			expect( Object.keys( data.cardMappings ).length ).toBe( 52 );
			expect( Object.keys( data.cardLocations ).length ).toBe( 52 );

			engine.setHands( hands );

			expect( hands[ 0 ].map( cardId => data.cardMappings[ cardId ] ).every( pid => pid === "p1" ) ).toBe( true );
			expect( hands[ 1 ].map( cardId => data.cardMappings[ cardId ] ).every( pid => pid === "p2" ) ).toBe( true );
			expect( hands[ 2 ].map( cardId => data.cardMappings[ cardId ] ).every( pid => pid === "p3" ) ).toBe( true );
			expect( hands[ 3 ].map( cardId => data.cardMappings[ cardId ] ).every( pid => pid === "p4" ) ).toBe( true );
		} );

		it.sequential( "should return error if trying to claim a book out of turn", async () => {
			const { error } = await engine.claimBook(
				{ gameId: engine.id, claim: { "AH": "p1", "AS": "p2" } },
				player2
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Not your turn!" );
		} );

		it.sequential( "should return error if trying to claim a book with incorrect number of cards", async () => {
			const { error } = await engine.claimBook(
				{ gameId: engine.id, claim: { "AH": "p1", "AS": "p2" } },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Incorrect number of cards claimed!" );
		} );

		it.sequential( "should return error if claim includes invalid player ids", async () => {
			const { error } = await engine.claimBook(
				{ gameId: engine.id, claim: { "AH": "p1", "AS": "p5", "AD": "p1", "AC": "p1" } },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Player p5 is not part of the game!" );
		} );

		it.sequential( "should return error if trying to claim a book with cards not owned", async () => {
			const { error } = await engine.claimBook(
				{ gameId: engine.id, claim: { "AH": "p2", "AS": "p2", "AC": "p2", "AD": "p2" } },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Claiming Player did not claim own cards!" );
		} );

		it.sequential( "should return error if claiming cards from multiple books", async () => {
			const { error } = await engine.claimBook(
				{ gameId: engine.id, claim: { "AH": "p1", "AS": "p2", "AC": "p1", "10H": "p1" } },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Cards Claimed from multiple books!" );
		} );

		it.sequential( "should return error if claiming cards from multiple teams", async () => {
			const { error } = await engine.claimBook(
				{ gameId: engine.id, claim: { "AH": "p1", "AS": "p4", "AC": "p1", "AD": "p1" } },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Book claimed from multiple teams!" );
		} );

		it.sequential( "should return error if trying to ask a card out of turn", async () => {
			const { error } = await engine.askCard( { gameId: engine.id, from: "p2", cardId: "AS" }, player2 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Not your turn!" );
		} );

		it.sequential( "should return error if asked player not part of game", async () => {
			const { error } = await engine.askCard(
				{ gameId: engine.id, from: "invalid-player", cardId: "AS" },
				player1
			);
			expect( error ).toBeDefined();
			expect( error ).toBe( "Asked player invalid-player is not part of the game!" );
		} );

		it.sequential( "should return error if asked player is from same team", async () => {
			const { error } = await engine.askCard( { gameId: engine.id, from: "p2", cardId: "AS" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( `The asked player is from the same team!` );
		} );

		it.sequential( "should return error if asking own card", async () => {
			const { error } = await engine.askCard( { gameId: engine.id, from: "p3", cardId: "AH" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "The asked card is with asking player itself!" );
		} );

		it.sequential( "should return error if asked card not part of the game", async () => {
			await engine.askCard( { gameId: engine.id, from: "p3", cardId: "AS" }, player1 );
			await engine.askCard( { gameId: engine.id, from: "p3", cardId: "AD" }, player1 );
			await engine.claimBook(
				{ gameId: engine.id, claim: { "AH": "p1", "AS": "p1", "AD": "p1", "AC": "p1" } },
				player1
			);

			const { error } = await engine.askCard( { gameId: engine.id, from: "p3", cardId: "AH" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Card AH does not exist in the game!" );
		} );

		it.sequential( "should return error if trying to transfer turn out of turn", async () => {
			const { error } = await engine.transferTurn( { gameId: engine.id, transferTo: "p2" }, player2 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Not your turn!" );
		} );

		it.sequential( "should return error if transferring turn to invalid player", async () => {
			const { error } = await engine.transferTurn( { gameId: engine.id, transferTo: "invalid-player" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "The Receiving Player is not part of the Game!" );
		} );

		it.sequential( "should return error if transferring turn to player from opposite team", async () => {
			const { error } = await engine.transferTurn( { gameId: engine.id, transferTo: "p3" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Turn can only be transferred to member of your team!" );
		} );

		it.sequential( "should return error if transferring turn to a player with no cards", async () => {
			engine.setHand( "p2", [] );
			const { error } = await engine.transferTurn( { gameId: engine.id, transferTo: "p2" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Turn can only be transferred to a player with cards!" );
		} );

		it( "should return error if no last claim available", async () => {
			engine.setHand( "p2", [ "7D" ] );
			engine.resetMoveHistory();
			const { error } = await engine.transferTurn( { gameId: engine.id, transferTo: "p2" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Turn can only be transferred after a successful claim!" );
		} );

		it.sequential( "should return error if last move type is not claim", async () => {
			const ask: AskEvent = {
				playerId: "p1",
				from: "p3",
				cardId: "7H",
				success: true,
				description: "",
				timestamp: Date.now()
			};

			engine.setLastMove( ask );
			const { error } = await engine.transferTurn( { gameId: engine.id, transferTo: "p2" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Turn can only be transferred after a successful claim!" );
		} );

		it( "should return error if last move claim was not successful", async () => {
			const claim: ClaimEvent = {
				playerId: "p1",
				book: "SEVENS",
				success: false,
				description: "",
				correctClaim: {},
				actualClaim: {},
				timestamp: Date.now()
			};

			engine.setLastMove( claim );
			const { error } = await engine.transferTurn( { gameId: engine.id, transferTo: "p2" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Turn can only be transferred after a successful claim!" );
		} );

		it( "should return error if last claim was not by the transferring player", async () => {
			const claim: ClaimEvent = {
				playerId: "p3",
				book: "SEVENS",
				success: true,
				description: "",
				correctClaim: {},
				actualClaim: {},
				timestamp: Date.now()
			};

			engine.setLastMove( claim );
			const { error } = await engine.transferTurn( { gameId: engine.id, transferTo: "p2" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Only the player who made the successful claim can transfer the turn!" );
		} );
	} );

	describe( "GamePlay: Happy Path", () => {
		let engine: MockFishEngine;

		it.sequential( "should load existing game data", async () => {
			const existingGameData: GameData = {
				id: "game-1",
				code: "ABC123",
				status: "CREATED",
				config: {
					playerCount: 4,
					teamCount: 2,
					type: "NORMAL",
					deckType: 52,
					books: [],
					bookSize: 4
				},
				playerIds: [],
				players: {},
				teamIds: [],
				teams: {},
				cardMappings: {},
				cardLocations: {},
				hands: {},
				cardCounts: {},
				askHistory: [],
				claimHistory: [],
				transferHistory: [],
				currentTurn: "",
				createdBy: "",
				metrics: {}
			};

			mockEnv.FISH_KV.get.mockResolvedValueOnce( existingGameData as any );
			engine = new MockFishEngine( mockDurableObjectState, mockEnv as unknown as Bindings );

			expect( mockEnv.FISH_KV.get ).toHaveBeenCalledWith( "mock-do-id", "json" );
		} );

		it.sequential( "should initialize the game with provided settings", async () => {
			await engine.initialize( { playerCount: 6, type: "CANADIAN", teamCount: 2 }, player1 );
			const { data } = await engine.getPlayerData( player1.id );

			expect( data ).toBeDefined();
			expect( data?.config.type ).toBe( "CANADIAN" );
			expect( data?.config.playerCount ).toBe( 6 );
			expect( data?.config.teamCount ).toBe( 2 );

			expect( mockEnv.FISH_KV.put ).toHaveBeenCalledWith( expect.stringContaining( "gameId:" ), "mock-do-id" );
			expect( mockEnv.FISH_KV.put ).toHaveBeenCalledWith( expect.stringContaining( "code:" ), "mock-do-id" );
			expect( mockEnv.FISH_KV.put ).toHaveBeenCalledWith( "mock-do-id", expect.any( String ) );
		} );

		it.sequential( "should add players when add players is called", async () => {
			await engine.addPlayer( player2 );
			await engine.addPlayer( player3 );
			await engine.addPlayer( player4 );
			await engine.addPlayer( player5 );
			await engine.addPlayer( player6 );

			const data = engine.getGameData();
			expect( Object.keys( data.players ).length ).toBe( 6 );
			expect( data.status ).toBe( "PLAYERS_READY" );

			engine.updatePlayers( {
				p1: player1,
				p2: player2,
				p3: player3,
				p4: { ...player4, isBot: true },
				p5: { ...player5, isBot: true },
				p6: { ...player6, isBot: true }
			} );
		} );

		it.sequential( "should create teams when create teams is called", async () => {
			const teamData = engine.getMockTeamStructure();
			const { error } = await engine.createTeams( { gameId: engine.id, teams: teamData }, player1 );
			expect( error ).toBeUndefined();

			const data = engine.getGameData();
			expect( data.status ).toBe( "TEAMS_CREATED" );

			engine.updateTeams();

			expect( data.teams ).toEqual( {
				"t1": { id: "t1", name: "t1", players: [ "p1", "p2", "p3" ], score: 0, booksWon: [] },
				"t2": { id: "t2", name: "t2", players: [ "p4", "p5", "p6" ], score: 0, booksWon: [] }
			} );
		} );

		it.sequential( "should start the game when start game is called", async () => {
			const { error } = await engine.startGame( player1 );
			expect( error ).toBeUndefined();

			const data = engine.getGameData();
			expect( data.status ).toBe( "IN_PROGRESS" );
			expect( Object.keys( data.cardMappings ).length ).toBe( 48 );
			expect( Object.keys( data.cardLocations ).length ).toBe( 48 );
		} );

		it.sequential( "should set hands correctly", async () => {
			const hands: CardId[][] = [
				[ "10H", "6H", "AC", "10C", "5S", "3S", "QD", "6D" ],
				[ "KH", "8H", "JC", "8C", "JS", "4S", "2S", "9D" ],
				[ "JH", "5H", "9C", "AS", "KS", "KD", "8D", "5D" ],
				[ "QH", "4H", "2H", "5C", "4C", "3C", "9S", "8S" ],
				[ "AH", "9H", "3H", "KC", "JD", "10D", "2D", "6S" ],
				[ "QC", "6C", "AD", "2C", "QS", "10S", "3D", "4D" ]
			];

			engine.setHands( hands );

			const data = engine.getGameData();
			expect( data.status ).toBe( "IN_PROGRESS" );

			expect( hands[ 0 ].map( cardId => data.cardMappings[ cardId ] ).every( pid => pid === "p1" ) ).toBe( true );
			expect( hands[ 1 ].map( cardId => data.cardMappings[ cardId ] ).every( pid => pid === "p2" ) ).toBe( true );
			expect( hands[ 2 ].map( cardId => data.cardMappings[ cardId ] ).every( pid => pid === "p3" ) ).toBe( true );
			expect( hands[ 3 ].map( cardId => data.cardMappings[ cardId ] ).every( pid => pid === "p4" ) ).toBe( true );
			expect( hands[ 4 ].map( cardId => data.cardMappings[ cardId ] ).every( pid => pid === "p5" ) ).toBe( true );
			expect( hands[ 5 ].map( cardId => data.cardMappings[ cardId ] ).every( pid => pid === "p6" ) ).toBe( true );
		} );

		it.sequential( "should ask a card successfully and update data accordingly", async () => {
			const { error } = await engine.askCard( { gameId: engine.id, from: "p5", cardId: "6S" }, player1 );
			expect( error ).toBeUndefined();

			const data = engine.getGameData();

			expect( data.cardCounts[ "p1" ] ).toBe( 9 );
			expect( data.cardCounts[ "p5" ] ).toBe( 7 );
			expect( data.askHistory.length ).toBe( 1 );

			const ask = data.askHistory[ 0 ];
			expect( ask?.success ).toBe( true );
			expect( ask?.from ).toBe( "p5" );
			expect( ask?.playerId ).toBe( "p1" );
			expect( ask?.cardId ).toBe( "6S" );

			expect( data.cardMappings[ "6S" ] ).toEqual( "p1" );
			expect( data.cardLocations[ "6S" ] ).toEqual( [ "p1" ] );
		} );

		it.sequential( "should claim a book successfully and update data accordingly", async () => {
			const claimInput = { "AS": "p3", "2S": "p2", "3S": "p1", "4S": "p2", "5S": "p1", "6S": "p1" };
			const { error } = await engine.claimBook( { gameId: engine.id, claim: claimInput }, player1 );

			expect( error ).toBeUndefined();

			const data = engine.getGameData();

			expect( data.cardCounts[ "p1" ] ).toBe( 6 );
			expect( data.cardCounts[ "p2" ] ).toBe( 6 );
			expect( data.cardCounts[ "p3" ] ).toBe( 7 );

			expect( data.claimHistory.length ).toBe( 1 );

			const claim = data.claimHistory[ 0 ];
			expect( claim?.playerId ).toBe( "p1" );
			expect( claim?.success ).toBe( true );

			expect( data.cardMappings[ "AS" ] ).toBeUndefined();
			expect( data.cardMappings[ "2S" ] ).toBeUndefined();
			expect( data.cardMappings[ "3S" ] ).toBeUndefined();
			expect( data.cardMappings[ "4S" ] ).toBeUndefined();
			expect( data.cardMappings[ "5S" ] ).toBeUndefined();
			expect( data.cardMappings[ "6S" ] ).toBeUndefined();

			expect( data.cardLocations[ "AS" ] ).toBeUndefined();
			expect( data.cardLocations[ "2S" ] ).toBeUndefined();
			expect( data.cardLocations[ "3S" ] ).toBeUndefined();
			expect( data.cardLocations[ "4S" ] ).toBeUndefined();
			expect( data.cardLocations[ "5S" ] ).toBeUndefined();
			expect( data.cardLocations[ "6S" ] ).toBeUndefined();

			expect( data.teams[ "t1" ].score ).toBe( 1 );
			expect( data.teams[ "t1" ].booksWon ).toEqual( [ "LS" ] );
		} );

		it.sequential( "should transfer turn successfully and update data accordingly", async () => {
			const { error } = await engine.transferTurn( { gameId: engine.id, transferTo: "p2" }, player1 );
			expect( error ).toBeUndefined();

			const data = engine.getGameData();
			expect( data.currentTurn ).toBe( "p2" );
			expect( data.transferHistory.length ).toBe( 1 );

			const transfer = data.transferHistory[ 0 ];
			expect( transfer?.playerId ).toBe( "p1" );
			expect( transfer?.transferTo ).toBe( "p2" );
		} );

		it.sequential( "should ask a wrong card and update data accordingly", async () => {
			const { error } = await engine.askCard( { gameId: engine.id, from: "p4", cardId: "10H" }, player2 );
			expect( error ).toBeUndefined();

			const data = engine.getGameData();
			expect( data.currentTurn ).toBe( "p4" );
			expect( data.cardCounts[ "p2" ] ).toBe( 6 );
			expect( data.cardCounts[ "p4" ] ).toBe( 8 );
			expect( data.askHistory.length ).toBe( 2 );

			const ask = data.askHistory[ 0 ];
			expect( ask?.success ).toBe( false );
			expect( ask?.from ).toBe( "p4" );
			expect( ask?.playerId ).toBe( "p2" );
			expect( ask?.cardId ).toBe( "10H" );

			expect( data.cardLocations[ "10H" ] ).toEqual( [ "p1", "p3", "p5", "p6" ] );
		} );

		it.sequential( "should make a wrong claim and update data accordingly", async () => {
			const claimInput = { "AH": "p5", "2H": "p4", "3H": "p4", "4H": "p4", "5H": "p6", "6H": "p6" };
			const { error } = await engine.claimBook( { gameId: engine.id, claim: claimInput }, player4 );

			expect( error ).toBeUndefined();

			const data = engine.getGameData();
			expect( [ "p1", "p2", "p3" ] ).contains( data.currentTurn );

			expect( data.cardMappings[ "AH" ] ).toBeUndefined();
			expect( data.cardMappings[ "2H" ] ).toBeUndefined();
			expect( data.cardMappings[ "3H" ] ).toBeUndefined();
			expect( data.cardMappings[ "4H" ] ).toBeUndefined();
			expect( data.cardMappings[ "5H" ] ).toBeUndefined();
			expect( data.cardMappings[ "6H" ] ).toBeUndefined();

			expect( data.cardLocations[ "AH" ] ).toBeUndefined();
			expect( data.cardLocations[ "2H" ] ).toBeUndefined();
			expect( data.cardLocations[ "3H" ] ).toBeUndefined();
			expect( data.cardLocations[ "4H" ] ).toBeUndefined();
			expect( data.cardLocations[ "5H" ] ).toBeUndefined();
			expect( data.cardLocations[ "6H" ] ).toBeUndefined();

			expect( data.claimHistory.length ).toBe( 2 );

			const claim = data.claimHistory[ 0 ];
			expect( claim.playerId ).toBe( "p4" );
			expect( claim.success ).toBe( false );
			expect( claim.actualClaim ).not.toEqual( claim.correctClaim );

			expect( data.teams[ "t2" ].score ).toBe( 0 );
			expect( data.teams[ "t2" ].booksWon ).toEqual( [] );

			expect( data.teams[ "t1" ].score ).toBe( 2 );
			expect( data.teams[ "t1" ].booksWon ).toEqual( [ "LS", "LH" ] );
		} );

		it.sequential( "should do nothing on alarm if current player is not a bot", async () => {
			await engine.alarm();
			expect( mockWss.broadcast ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_KV.put ).not.toHaveBeenCalled();
		} );

		it.sequential( "should suggest ask if current player is a bot", async () => {
			const { currentTurn, players } = engine.getGameData();
			engine.setHands( [
				currentTurn === "p1" ? [ "10H" ] : [],
				currentTurn === "p2" ? [ "10H" ] : [],
				currentTurn === "p3" ? [ "10H" ] : [],
				[ "KH", "QH", "JH" ],
				[ "8H", "8S" ],
				[ "9H", "9S", "10S", "JS", "QS", "KS" ]
			] );

			const { error } = await engine.askCard(
				{ gameId: engine.id, from: "p5", cardId: "QH" },
				players[ currentTurn ]
			);
			expect( error ).toBeUndefined();

			engine.setScores( {
				t1: [ "LC", "LD", "LH" ],
				t2: [ "LS", "UC", "UD" ]
			} );

			engine.setCardLocations( {
				"10H": [ currentTurn ],
				"KH": [ "p4" ],
				"QH": [ "p4" ],
				"JH": [ "p4" ],
				"8H": [ "p5" ],
				"9H": [ "p6" ],
				"8S": [ "p4", "p5" ],
				"9S": [ "p6" ],
				"10S": [ "p6" ],
				"JS": [ "p6" ],
				"QS": [ "p6" ],
				"KS": [ "p6" ]
			} );

			await engine.alarm();
			const data = engine.getGameData();
			expect( data.askHistory.length ).toBe( 4 );

			const ask = data.askHistory[ 0 ];
			expect( ask.playerId ).toBe( "p5" );
			expect( ask.from ).toBe( currentTurn );
			expect( ask.cardId ).toBe( "10H" );
			expect( ask.success ).toBe( true );

		} );

		it.sequential( "should suggest claim if bot has a book to claim", async () => {
			await engine.alarm();
			const data = engine.getGameData();
			expect( data.claimHistory.length ).toBe( 3 );

			const claim = data.claimHistory[ 0 ];
			expect( claim.playerId ).toBe( data.currentTurn );
			expect( claim.success ).toBe( true );

			const expectedClaim = { "KH": "p4", "QH": "p4", "JH": "p4", "10H": "p5", "9H": "p6", "8H": "p5" };
			expect( claim.actualClaim ).toEqual( expectedClaim );
		} );

		it.sequential( "should suggest transfer if bot can transfer turn", async () => {
			await engine.alarm();
			const data = engine.getGameData();
			expect( data.transferHistory.length ).toBe( 2 );

			const transfer = data.transferHistory[ 0 ];
			expect( transfer.playerId ).toBe( "p5" );
			expect( transfer.transferTo ).toBe( "p6" );
		} );

		it( "should complete the game on alarm when all books are claimed", async () => {
			await engine.alarm();
			await engine.alarm();

			const data = engine.getGameData();
			expect( data.status ).toBe( "COMPLETED" );
			expect( data.teams[ "t1" ].score + data.teams[ "t2" ].score ).toBe( data.config.books.length );
		} );
	} );

} );