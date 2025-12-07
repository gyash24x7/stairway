import { generateId } from "@s2h/utils/generator";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callbreak } from "../src/router.ts";
import type { HonoEnv } from "../src/types.ts";

describe( "Callbreak:Router", () => {

	const mockEnv = {
		CALLBREAK_KV: {
			get: vi.fn()
		},
		CALLBREAK_DO: {
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
		username: "callbreakPlayer",
		name: "Callbreak Player",
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
		declareDealWins: vi.fn(),
		playCard: vi.fn()
	};

	const testApp = new Hono<HonoEnv>();
	testApp.use( async ( ctx, next ) => {
		ctx.set( "authInfo", mockAuthInfo );
		await next();
	} );

	testApp.route( "/", callbreak );

	beforeEach( () => {
		vi.mocked( mockEnv.CALLBREAK_KV.get ).mockResolvedValue( "durable-object-id-123" );
		vi.mocked( mockEnv.CALLBREAK_DO.idFromString ).mockReturnValue( mockDurableObjectId );
		vi.mocked( mockEnv.CALLBREAK_DO.get ).mockReturnValue( mockEngine );
	} );

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "POST /", () => {

		it( "should create a new game and return the gameId", async () => {
			const mockGameId = "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C";
			vi.mocked( mockEngine.initialize ).mockResolvedValue( { data: mockGameId } );
			vi.mocked( mockEnv.CALLBREAK_DO.newUniqueId ).mockReturnValue( mockDurableObjectId );
			vi.mocked( mockEnv.CALLBREAK_DO.get ).mockReturnValue( mockEngine );

			const response = await testApp.request(
				"http://localhost/",
				{ method: "POST", headers, body: JSON.stringify( { dealCount: 9, trumpSuit: "H" } ) },
				mockEnv
			);

			const data = await response.json();

			expect( response.status ).toBe( 200 );
			expect( data ).toEqual( { gameId: mockGameId } );
			expect( mockEnv.CALLBREAK_DO.newUniqueId ).toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.initialize ).toHaveBeenCalledWith( { dealCount: 9, trumpSuit: "H" }, "user1" );
		} );

		it( "should return 400 if request body is invalid", async () => {
			const response = await testApp.request(
				"http://localhost/",
				{ method: "POST", headers, body: JSON.stringify( { dealCount: 7, trumpSuit: "X" } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.CALLBREAK_DO.newUniqueId ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.initialize ).not.toHaveBeenCalled();
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
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( "user1" );
		} );

		it( "should return 400 if gameId is invalid", async () => {
			const response = await testApp.request(
				"http://localhost/invalid-game-id",
				{ method: "GET", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
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
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( "user1" );
		} );

		it( "should return 404 if key not found in KV", async () => {
			vi.mocked( mockEnv.CALLBREAK_KV.get ).mockResolvedValue( null );

			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C",
				{ method: "GET", headers },
				mockEnv
			);

			expect( response.status ).toBe( 404 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
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
			expect( mockEnv.CALLBREAK_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addPlayer ).toHaveBeenCalledWith( mockAuthInfo );
		} );

		it( "should return 404 if code is invalid", async () => {
			vi.mocked( mockEnv.CALLBREAK_KV.get ).mockResolvedValue( null );

			const response = await testApp.request(
				"http://localhost/join",
				{ method: "POST", headers, body: JSON.stringify( { code: "ABC123" } ) },
				mockEnv
			);

			expect( response.status ).toBe( 404 );
			expect( mockEnv.CALLBREAK_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
			expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.addPlayer ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if request body is invalid", async () => {
			const response = await testApp.request(
				"http://localhost/join",
				{ method: "POST", headers, body: JSON.stringify( { code: "TOO_LONG_CODE" } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.CALLBREAK_KV.get ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
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
			expect( mockEnv.CALLBREAK_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
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
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addBots ).toHaveBeenCalledWith( mockAuthInfo );
		} );

		it( "should return 400 if gameId is invalid", async () => {
			const response = await testApp.request(
				"http://localhost/invalid-game-id/add-bots",
				{ method: "PUT", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
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
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addBots ).toHaveBeenCalledWith( mockAuthInfo );
		} );
	} );

	describe( "PUT /:gameId/declare-deal-wins", () => {

		it( "should declare deal wins successfully", async () => {
			vi.mocked( mockEngine.declareDealWins ).mockResolvedValue( {} );

			const input = { wins: 5, dealId: generateId() };
			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/declare-deal-wins",
				{ method: "PUT", headers, body: JSON.stringify( input ) },
				mockEnv
			);

			expect( response.status ).toBe( 204 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.declareDealWins ).toHaveBeenCalledWith( input, mockAuthInfo );
		} );

		it( "should return 400 if request body is invalid", async () => {
			const input = { wins: 15, dealId: "invalid-deal-id" };
			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/declare-deal-wins",
				{ method: "PUT", headers, body: JSON.stringify( input ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.declareDealWins ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if gameId is invalid", async () => {
			const input = { wins: 5, dealId: generateId() };
			const response = await testApp.request(
				"http://localhost/invalid-game-id/declare-deal-wins",
				{ method: "PUT", headers, body: JSON.stringify( input ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.declareDealWins ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.declareDealWins ).mockResolvedValue( { error: "Unable to declare wins" } );

			const input = { wins: 5, dealId: generateId() };
			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/declare-deal-wins",
				{ method: "PUT", headers, body: JSON.stringify( input ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.declareDealWins ).toHaveBeenCalledWith( input, mockAuthInfo );
		} );

	} );

	describe( "PUT /:gameId/play-card", () => {

		it( "should play a card successfully", async () => {
			vi.mocked( mockEngine.playCard ).mockResolvedValue( {} );

			const input = { cardId: "5H", dealId: generateId(), roundId: generateId() };
			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/play-card",
				{ method: "PUT", headers, body: JSON.stringify( input ) },
				mockEnv
			);

			expect( response.status ).toBe( 204 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.playCard ).toHaveBeenCalledWith( input, mockAuthInfo );
		} );

		it( "should return 400 if request body is invalid", async () => {
			const input = { cardId: "XX", dealId: "invalid-deal-id", roundId: "invalid-round-id" };
			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/play-card",
				{ method: "PUT", headers, body: JSON.stringify( input ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.playCard ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if gameId is invalid", async () => {
			const input = { cardId: "5H", dealId: generateId(), roundId: generateId() };
			const response = await testApp.request(
				"http://localhost/invalid-game-id/play-card",
				{ method: "PUT", headers, body: JSON.stringify( input ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.playCard ).not.toHaveBeenCalled();
		} );

		it( "should return 400 if engine returns an error", async () => {
			vi.mocked( mockEngine.playCard ).mockResolvedValue( { error: "Unable to play card" } );

			const input = { cardId: "5H", dealId: generateId(), roundId: generateId() };
			const response = await testApp.request(
				"http://localhost/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/play-card",
				{ method: "PUT", headers, body: JSON.stringify( input ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.playCard ).toHaveBeenCalledWith( input, mockAuthInfo );
		} );

	} );

} );