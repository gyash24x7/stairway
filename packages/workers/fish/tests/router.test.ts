import { generateId } from "@s2h/utils/generator";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fish } from "../src/router.ts";
import type { HonoEnv } from "../src/types.ts";

describe( "Fish:Router", () => {

	const mockEnv = {
		FISH_KV: {
			get: vi.fn()
		},
		FISH_DO: {
			idFromString: vi.fn(),
			get: vi.fn(),
			newUniqueId: vi.fn()
		}
	};

	const headers = new Headers( {
		"Content-Type": "application/json"
	} );

	const mockAuthInfo = {
		id: "user1",
		username: "fishPlayer",
		name: "Fish Player",
		avatar: "avatar.png"
	};

	const mockDurableObjectId = {
		toString: vi.fn().mockReturnValue( "durable-object-id-123" )
	};

	const mockEngine = {
		initialize: vi.fn(),
		getPlayerData: vi.fn(),
		addPlayer: vi.fn(),
		addBots: vi.fn(),
		createTeams: vi.fn(),
		startGame: vi.fn(),
		askCard: vi.fn(),
		claimBook: vi.fn(),
		transferTurn: vi.fn()
	};

	const testApp = new Hono<HonoEnv>();
	testApp.use( async ( ctx, next ) => {
		ctx.set( "authInfo", mockAuthInfo );
		await next();
	} );

	testApp.route( "/", fish );

	beforeEach( () => {
		vi.mocked( mockEnv.FISH_KV.get ).mockResolvedValue( "durable-object-id-123" );
		vi.mocked( mockEnv.FISH_DO.idFromString ).mockReturnValue( mockDurableObjectId );
		vi.mocked( mockEnv.FISH_DO.get ).mockReturnValue( mockEngine );
	} );

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "POST /", () => {

		it( "should create a new game and return the gameId", async () => {
			const mockGameId = "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C";
			vi.mocked( mockEngine.initialize ).mockResolvedValue( { data: mockGameId } );
			vi.mocked( mockEnv.FISH_DO.newUniqueId ).mockReturnValue( mockDurableObjectId );
			vi.mocked( mockEnv.FISH_DO.get ).mockReturnValue( mockEngine );

			const response = await testApp.request(
				"http://localhost/",
				{ method: "POST", headers, body: JSON.stringify( { playerCount: 4, type: "NORMAL", teamCount: 2 } ) },
				mockEnv
			);

			const data = await response.json();

			expect( response.status ).toBe( 200 );
			expect( data ).toEqual( { gameId: mockGameId } );
			expect( mockEnv.FISH_DO.newUniqueId ).toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.initialize )
				.toHaveBeenCalledWith( { playerCount: 4, type: "NORMAL", teamCount: 2 }, mockAuthInfo );
		} );

		it( "should return 400 if request body is invalid", async () => {
			const response = await testApp.request(
				"http://localhost/",
				{ method: "POST", headers, body: JSON.stringify( { playerCount: 5, type: "WEIRD", teamCount: 7 } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.newUniqueId ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.initialize ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.initialize ).mockResolvedValue( { error: "Unable to create game" } );
			vi.mocked( mockEnv.FISH_DO.newUniqueId ).mockReturnValue( mockDurableObjectId );
			vi.mocked( mockEnv.FISH_DO.get ).mockReturnValue( mockEngine );

			const response = await testApp.request(
				"http://localhost/",
				{ method: "POST", headers, body: JSON.stringify( { playerCount: 4, type: "NORMAL", teamCount: 2 } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.newUniqueId ).toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.initialize )
				.toHaveBeenCalledWith( { playerCount: 4, type: "NORMAL", teamCount: 2 }, mockAuthInfo );
		} );

	} );

	describe( "GET /:gameId", () => {

		it( "should fetch player data for a valid gameId", async () => {
			const mockPlayerData = { playerId: "user1", hand: [], score: 0 };
			vi.mocked( mockEngine.getPlayerData ).mockResolvedValue( { data: mockPlayerData } );

			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C",
				{ method: "GET", headers },
				mockEnv
			);

			const data = await response.json();

			expect( response.status ).toBe( 200 );
			expect( data ).toEqual( mockPlayerData );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( "user1" );
		} );

		it( "should return 400 if gameId is invalid", async () => {
			const response = await testApp.request(
				"http://localhost/invalid-game-id",
				{ method: "GET", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.getPlayerData ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.getPlayerData ).mockResolvedValue( { error: "Unable to fetch player data" } );

			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C",
				{ method: "GET", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( "user1" );
		} );

		it( "should return 404 if key not found in KV", async () => {
			vi.mocked( mockEnv.FISH_KV.get ).mockResolvedValue( null );

			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C",
				{ method: "GET", headers },
				mockEnv
			);

			expect( response.status ).toBe( 404 );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.getPlayerData ).not.toHaveBeenCalled();
		} );

	} );

	describe( "POST /join", () => {

		it( "should join a game with a valid code and return the gameId", async () => {
			const mockGameId = "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C";
			vi.mocked( mockEngine.addPlayer ).mockResolvedValue( { data: mockGameId } );

			const response = await testApp.request(
				"http://localhost/join",
				{ method: "POST", headers, body: JSON.stringify( { code: "ABC123" } ) },
				mockEnv
			);

			const data = await response.json();

			expect( response.status ).toBe( 200 );
			expect( data ).toEqual( { gameId: mockGameId } );
			expect( mockEnv.FISH_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addPlayer ).toHaveBeenCalledWith( mockAuthInfo );
		} );

		it( "should return 404 if code is invalid", async () => {
			vi.mocked( mockEnv.FISH_KV.get ).mockResolvedValue( null );

			const response = await testApp.request(
				"http://localhost/join",
				{ method: "POST", headers, body: JSON.stringify( { code: "ABC123" } ) },
				mockEnv
			);

			expect( response.status ).toBe( 404 );
			expect( mockEnv.FISH_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.addPlayer ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if request body is invalid", async () => {
			const response = await testApp.request(
				"http://localhost/join",
				{ method: "POST", headers, body: JSON.stringify( { code: "TOO_LONG_CODE" } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_KV.get ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.addPlayer ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.addPlayer ).mockResolvedValue( { error: "Unable to join game" } );

			const response = await testApp.request(
				"http://localhost/join",
				{ method: "POST", headers, body: JSON.stringify( { code: "ABC123" } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addPlayer ).toHaveBeenCalledWith( mockAuthInfo );
		} );

	} );

	describe( "PUT /:gameId/add-bots", () => {

		it( "should add bots successfully", async () => {
			vi.mocked( mockEngine.addBots ).mockResolvedValue( {} );

			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/add-bots",
				{ method: "PUT", headers },
				mockEnv
			);

			expect( response.status ).toBe( 204 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addBots ).toHaveBeenCalledWith( mockAuthInfo );
		} );

		it( "should return 400 if gameId is invalid", async () => {
			const response = await testApp.request(
				"http://localhost/invalid-game-id/add-bots",
				{ method: "PUT", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.addBots ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.addBots ).mockResolvedValue( { error: "Unable to add bots" } );

			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/add-bots",
				{ method: "PUT", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addBots ).toHaveBeenCalledWith( mockAuthInfo );
		} );
	} );

	describe( "PUT /:gameId/create-teams", () => {

		it( "should create teams successfully", async () => {
			vi.mocked( mockEngine.createTeams ).mockResolvedValue( {} );

			const body = { teamA: [ generateId(), generateId() ], teamB: [ generateId(), generateId() ] };
			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/create-teams",
				{ method: "PUT", headers, body: JSON.stringify( body ) },
				mockEnv
			);

			expect( response.status ).toBe( 204 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.createTeams ).toHaveBeenCalledWith( body, mockAuthInfo );
		} );

		it( "should return 400 if request body is invalid", async () => {
			const body = { teamA: [ "invalid-id" ] };
			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/create-teams",
				{ method: "PUT", headers, body: JSON.stringify( body ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.createTeams ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if gameId is invalid", async () => {
			const body = { teamA: [ generateId() ] };
			const response = await testApp.request(
				"http://localhost/invalid-game-id/create-teams",
				{ method: "PUT", headers, body: JSON.stringify( body ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.createTeams ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.createTeams ).mockResolvedValue( { error: "Unable to create teams" } );

			const body = { teamA: [ generateId() ] };
			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/create-teams",
				{ method: "PUT", headers, body: JSON.stringify( body ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.createTeams ).toHaveBeenCalledWith( body, mockAuthInfo );
		} );
	} );

	describe( "PUT /:gameId/start-game", () => {

		it( "should start a game successfully", async () => {
			vi.mocked( mockEngine.startGame ).mockResolvedValue( {} );

			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/start-game",
				{ method: "PUT", headers },
				mockEnv
			);

			expect( response.status ).toBe( 204 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.startGame ).toHaveBeenCalledWith( mockAuthInfo );
		} );

		it( "should return 400 if gameId is invalid", async () => {
			const response = await testApp.request(
				"http://localhost/invalid-game-id/start-game",
				{ method: "PUT", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.startGame ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.startGame ).mockResolvedValue( { error: "Unable to start game" } );

			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/start-game",
				{ method: "PUT", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.startGame ).toHaveBeenCalledWith( mockAuthInfo );
		} );
	} );

	describe( "PUT /:gameId/ask-card", () => {

		it( "should ask a card successfully", async () => {
			vi.mocked( mockEngine.askCard ).mockResolvedValue( {} );

			const body = { from: generateId(), cardId: "5H" };
			const response = await testApp.request(
				`http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/ask-card`,
				{ method: "PUT", headers, body: JSON.stringify( body ) },
				mockEnv
			);

			expect( response.status ).toBe( 204 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.askCard ).toHaveBeenCalledWith( body, mockAuthInfo );
		} );

		it( "should return 400 if request body is invalid", async () => {
			const body = { from: "invalid-id", cardId: "XX" };
			const response = await testApp.request(
				`http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/ask-card`,
				{ method: "PUT", headers, body: JSON.stringify( body ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.askCard ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.askCard ).mockResolvedValue( { error: "Unable to ask card" } );

			const body = { from: generateId(), cardId: "5H" };
			const response = await testApp.request(
				`http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/ask-card`,
				{ method: "PUT", headers, body: JSON.stringify( body ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.askCard ).toHaveBeenCalledWith( body, mockAuthInfo );
		} );
	} );

	describe( "PUT /:gameId/claim-book", () => {

		it( "should claim book successfully", async () => {
			vi.mocked( mockEngine.claimBook ).mockResolvedValue( {} );

			const payload: Record<string, string> = { "5H": generateId() };
			const response = await testApp.request(
				`http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/claim-book`,
				{ method: "PUT", headers, body: JSON.stringify( payload ) },
				mockEnv
			);

			expect( response.status ).toBe( 204 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.claimBook ).toHaveBeenCalledWith( payload, mockAuthInfo );
		} );

		it( "should return 400 if request body is invalid", async () => {
			const payload = { "XX": "invalid-id" };
			const response = await testApp.request(
				`http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/claim-book`,
				{ method: "PUT", headers, body: JSON.stringify( payload ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.claimBook ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.claimBook ).mockResolvedValue( { error: "Unable to claim book" } );

			const payload: Record<string, string> = { "5H": generateId() };
			const response = await testApp.request(
				`http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/claim-book`,
				{ method: "PUT", headers, body: JSON.stringify( payload ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.claimBook ).toHaveBeenCalledWith( payload, mockAuthInfo );
		} );
	} );

	describe( "PUT /:gameId/transfer-turn", () => {

		it( "should transfer turn successfully", async () => {
			vi.mocked( mockEngine.transferTurn ).mockResolvedValue( {} );

			const body = { transferTo: generateId() };
			const response = await testApp.request(
				`http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/transfer-turn`,
				{ method: "PUT", headers, body: JSON.stringify( body ) },
				mockEnv
			);

			expect( response.status ).toBe( 204 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.transferTurn ).toHaveBeenCalledWith( body, mockAuthInfo );
		} );

		it( "should return 400 if request body is invalid", async () => {
			const body = { transferTo: "invalid-id" };
			const response = await testApp.request(
				`http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/transfer-turn`,
				{ method: "PUT", headers, body: JSON.stringify( body ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.transferTurn ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.transferTurn ).mockResolvedValue( { error: "Unable to transfer turn" } );

			const body = { transferTo: generateId() };
			const response = await testApp.request(
				`http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/transfer-turn`,
				{ method: "PUT", headers, body: JSON.stringify( body ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.transferTurn ).toHaveBeenCalledWith( body, mockAuthInfo );
		} );
	} );

} );

