import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { wordle } from "../src/router.ts";
import type { HonoEnv } from "../src/types.ts";

describe( "Wordle:Router", () => {

	const mockEnv = {
		WORDLE_KV: {
			get: vi.fn()
		},
		WORDLE_DO: {
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
		username: "wordlePlayer",
		name: "Wordle Player",
		avatar: "avatar.png"
	};

	const mockDurableObjectId = {
		toString: vi.fn().mockReturnValue( "durable-object-id-123" )
	};

	const mockEngine = {
		initialize: vi.fn(),
		getPlayerData: vi.fn(),
		getWords: vi.fn(),
		makeGuess: vi.fn()
	};

	const mockPlayerData = {
		id: "game1",
		playerId: "user1",
		wordCount: 5,
		wordLength: 5,
		guesses: [],
		guessBlocks: [],
		completedWords: [],
		completed: false
	};

	const testApp = new Hono<HonoEnv>();
	testApp.use( async ( ctx, next ) => {
		ctx.set( "authInfo", mockAuthInfo );
		await next();
	} );

	testApp.route( "/", wordle );

	beforeEach( () => {
		vi.mocked( mockEnv.WORDLE_KV.get ).mockResolvedValue( "durable-object-id-123" );
		vi.mocked( mockEnv.WORDLE_DO.idFromString ).mockReturnValue( mockDurableObjectId );
		vi.mocked( mockEnv.WORDLE_DO.get ).mockReturnValue( mockEngine );
	} );

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "POST /", () => {

		it( "should create a new Wordle game and return the gameId", async () => {
			const mockGameId = "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C";
			vi.mocked( mockEngine.initialize ).mockResolvedValue( { data: mockGameId } );
			vi.mocked( mockEnv.WORDLE_DO.newUniqueId ).mockReturnValue( mockDurableObjectId );
			vi.mocked( mockEnv.WORDLE_DO.get ).mockReturnValue( mockEngine );

			const response = await testApp.request(
				"/",
				{ method: "POST", headers, body: JSON.stringify( { wordCount: 5, wordLength: 5 } ) },
				mockEnv
			);

			const data = await response.json();
			expect( data ).toEqual( { gameId: mockGameId } );
			expect( mockEnv.WORDLE_DO.newUniqueId ).toHaveBeenCalled();
			expect( mockEnv.WORDLE_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.initialize ).toHaveBeenCalledWith( { wordCount: 5, wordLength: 5 }, mockAuthInfo.id );
		} );

		it( "should throw 400 error for invalid input", async () => {
			const response = await testApp.request(
				"/",
				{ method: "POST", headers, body: JSON.stringify( { wordCount: -1, wordLength: 10 } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEnv.WORDLE_DO.newUniqueId ).not.toHaveBeenCalled();
			expect( mockEnv.WORDLE_DO.get ).not.toHaveBeenCalled();
			expect( mockEngine.initialize ).not.toHaveBeenCalled();
		} );

	} );

	describe( "GET /:gameId", () => {

		it( "should return player data for the specified gameId", async () => {
			vi.mocked( mockEngine.getPlayerData ).mockResolvedValue( { data: mockPlayerData } );

			const response = await testApp.request(
				"/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C",
				{ method: "GET", headers },
				mockEnv
			);

			const data = await response.json();
			expect( data ).toEqual( mockPlayerData );
			expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( mockAuthInfo.id );
		} );

		it( "should throw 400 error for invalid gameId", async () => {
			const response = await testApp.request(
				"/INVALID_GAME_ID",
				{ method: "GET", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
		} );

		it( "should throw 400 error if player data cannot be fetched", async () => {
			vi.mocked( mockEngine.getPlayerData ).mockResolvedValue( { data: null, error: "Fetch error" } );

			const response = await testApp.request(
				"/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C",
				{ method: "GET", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( mockAuthInfo.id );
		} );

		it( "should throw 404 error if Durable Object ID is not found", async () => {
			vi.mocked( mockEnv.WORDLE_KV.get ).mockResolvedValue( null );

			const response = await testApp.request(
				"/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C",
				{ method: "GET", headers },
				mockEnv
			);

			expect( response.status ).toBe( 404 );
			expect( mockEnv.WORDLE_KV.get ).toHaveBeenCalledWith( "gameId:01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" );
		} );

	} );

	describe( "GET /:gameId/words", () => {

		it( "should return the list of words for the specified gameId", async () => {
			vi.mocked( mockEngine.getWords ).mockResolvedValue( { data: [ "apple", "berry", "cherry" ] } );

			const response = await testApp.request(
				"/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/words",
				{ method: "GET", headers },
				mockEnv
			);

			const data = await response.json();
			expect( data ).toEqual( { words: [ "apple", "berry", "cherry" ] } );
			expect( mockEngine.getWords ).toHaveBeenCalledWith( mockAuthInfo.id );
		} );

		it( "should throw 400 error if words cannot be fetched", async () => {
			vi.mocked( mockEngine.getWords ).mockResolvedValue( { data: null, error: "Fetch error" } );

			const response = await testApp.request(
				"/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/words",
				{ method: "GET", headers },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEngine.getWords ).toHaveBeenCalledWith( mockAuthInfo.id );
		} );

	} );

	describe( "PUT /:gameId/guess", () => {

		it( "should process the guess and return the result", async () => {
			const mockResult = { ...mockPlayerData, guesses: [ "apple" ] };
			vi.mocked( mockEngine.makeGuess ).mockResolvedValue( { data: mockResult } );

			const response = await testApp.request(
				"/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/guess",
				{ method: "PUT", headers, body: JSON.stringify( { guess: "apple" } ) },
				mockEnv
			);

			const data = await response.json();
			expect( data ).toEqual( mockResult );
			expect( mockEngine.makeGuess ).toHaveBeenCalledWith( { guess: "apple" }, mockAuthInfo.id );
		} );

		it( "should throw 400 error for invalid guess input", async () => {
			const response = await testApp.request(
				"/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/guess",
				{ method: "PUT", headers, body: JSON.stringify( { guess: "" } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEngine.makeGuess ).not.toHaveBeenCalled();
		} );

		it( "should throw 400 error if guess cannot be processed", async () => {
			vi.mocked( mockEngine.makeGuess ).mockResolvedValue( { data: null, error: "Processing error" } );

			const response = await testApp.request(
				"/01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C/guess",
				{ method: "PUT", headers, body: JSON.stringify( { guess: "apple" } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
			expect( mockEngine.makeGuess ).toHaveBeenCalledWith( { guess: "apple" }, mockAuthInfo.id );
		} );

	} );
} );