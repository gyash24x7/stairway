import { call } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordleEngine } from "../src/engine.ts";
import { wordle } from "../src/router.ts";
import type { Bindings, PlayerGameInfo } from "../src/types.ts";

describe( "Wordle:Procedure:Router", () => {

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

	const mockAuthInfo = {
		id: "user1",
		username: "wordlePlayer",
		name: "Wordle Player",
		avatar: "avatar.png"
	};

	const mockDurableObjectId = {
		toString: vi.fn().mockReturnValue( "durable-object-id-123" )
	} as unknown as DurableObjectId;

	const mockEngine = {
		initialize: vi.fn(),
		getPlayerData: vi.fn(),
		getWords: vi.fn(),
		makeGuess: vi.fn()
	};

	const mockPlayerData: PlayerGameInfo = {
		id: "game1",
		playerId: "user1",
		wordCount: 5,
		wordLength: 5,
		guesses: [],
		guessBlocks: [],
		completedWords: [],
		completed: false
	};

	const mockContext = { env: mockEnv as unknown as Bindings, authInfo: mockAuthInfo };

	beforeEach( () => {
		mockEnv.WORDLE_KV.get.mockResolvedValue( "durable-object-id-123" as any );
		mockEnv.WORDLE_DO.idFromString.mockReturnValue( mockDurableObjectId );
		mockEnv.WORDLE_DO.get.mockReturnValue( mockEngine as unknown as DurableObjectStub<WordleEngine> );
	} );

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "Wordle:Procedure:CreateGame", () => {

		it( "should create a new Wordle game and return the gameId", async () => {
			const mockGameId = "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C";
			mockEngine.initialize.mockResolvedValue( { data: mockGameId } );
			mockEnv.WORDLE_DO.newUniqueId.mockReturnValue( mockDurableObjectId );

			const data = await call( wordle.createGame, { wordCount: 5, wordLength: 5 }, { context: mockContext } );

			expect( data ).toEqual( { gameId: mockGameId } );
			expect( mockEnv.WORDLE_DO.newUniqueId ).toHaveBeenCalled();
			expect( mockEnv.WORDLE_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.initialize ).toHaveBeenCalledWith( { wordCount: 5, wordLength: 5 }, mockAuthInfo.id );
		} );

		it( "should throw BAD_REQUEST error for invalid input", async () => {
			expect.assertions( 4 );
			await call( wordle.createGame, { wordCount: -1, wordLength: 4 }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
					expect( mockEnv.WORDLE_DO.newUniqueId ).not.toHaveBeenCalled();
					expect( mockEnv.WORDLE_DO.get ).not.toHaveBeenCalled();
					expect( mockEngine.initialize ).not.toHaveBeenCalled();
				} );
		} );

	} );

	describe( "Wordle:Procedure:GetGameData", () => {

		it( "should return player data for the specified gameId", async () => {
			mockEngine.getPlayerData.mockResolvedValue( { data: mockPlayerData } );

			const data = await call(
				wordle.getGameData,
				{ gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" },
				{ context: mockContext }
			);

			expect( data ).toEqual( mockPlayerData );
			expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( mockAuthInfo.id );
		} );

		it( "should return BAD_REQUEST if gameId is invalid", async () => {
			expect.assertions( 1 );
			await call( wordle.getGameData, { gameId: "INVALID_GAME_ID" }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
			} );
		} );

		it( "should return BAD_REQUEST if player data cannot be fetched", async () => {
			mockEngine.getPlayerData.mockResolvedValue( { data: null, error: "Fetch error" } );
			expect.assertions( 2 );
			await call( wordle.getGameData, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
				} );
			expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( mockAuthInfo.id );
		} );

		it( "should return NOT_FOUND if Durable Object ID is not found", async () => {
			mockEnv.WORDLE_KV.get.mockResolvedValue( null as any );
			expect.assertions( 2 );
			await call( wordle.getGameData, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
				} );
			expect( mockEnv.WORDLE_KV.get ).toHaveBeenCalledWith( "gameId:01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" );
		} );

	} );

	describe( "Wordle:Procedure:GetWords", () => {

		it( "should return the list of words for the specified gameId", async () => {
			mockEngine.getWords.mockResolvedValue( { data: [ "apple", "berry", "cherry" ] } );

			const data = await call(
				wordle.getWords,
				{ gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" },
				{ context: mockContext }
			);

			expect( data ).toEqual( { words: [ "apple", "berry", "cherry" ] } );
			expect( mockEngine.getWords ).toHaveBeenCalledWith( mockAuthInfo.id );
		} );

		it( "should return BAD_REQUEST if words cannot be fetched", async () => {
			mockEngine.getWords.mockResolvedValue( { data: null, error: "Fetch error" } );
			expect.assertions( 2 );
			await call( wordle.getWords, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
				} );
			expect( mockEngine.getWords ).toHaveBeenCalledWith( mockAuthInfo.id );
		} );

	} );

	describe( "Wordle:Procedure:MakeGuess", () => {

		it( "should process the guess and return the result", async () => {
			const mockResult = { ...mockPlayerData, guesses: [ "apple" ] };
			mockEngine.makeGuess.mockResolvedValue( { data: mockResult } );

			const data = await call(
				wordle.makeGuess,
				{ gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C", guess: "apple" },
				{ context: mockContext }
			);

			expect( data ).toEqual( mockResult );
			expect( mockEngine.makeGuess ).toHaveBeenCalledWith( { guess: "apple" }, mockAuthInfo.id );
		} );

		it( "should return BAD_REQUEST for invalid guess input", async () => {
			expect.assertions( 2 );
			await call(
				wordle.makeGuess,
				{ gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C", guess: "" },
				{ context: mockContext }
			).catch( error => {
				expect( error ).toBeDefined();
			} );
			expect( mockEngine.makeGuess ).not.toHaveBeenCalled();
		} );

		it( "should return BAD_REQUEST if guess cannot be processed", async () => {
			mockEngine.makeGuess.mockResolvedValue( { data: null, error: "Processing error" } );
			expect.assertions( 2 );
			await call(
				wordle.makeGuess,
				{ gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C", guess: "apple" },
				{ context: mockContext }
			).catch( error => {
				expect( error ).toBeDefined();
			} );
			expect( mockEngine.makeGuess ).toHaveBeenCalledWith( { guess: "apple" }, mockAuthInfo.id );
		} );

	} );
} );