import { afterEach, describe, expect, it, vi } from "vitest";
import { WordleEngine } from "../src/engine.ts";
import type { Bindings } from "../src/types.ts";

vi.mock( "cloudflare:workers", () => ( {
	DurableObject: class {
		constructor( public ctx: DurableObjectState, public env: Bindings ) { }
	}
} ) );

class MockWordleEngine extends WordleEngine {
	public setWords( words: string[] ) {
		this.data.words = words;
	}
}

describe( "Wordle:Engine", () => {
	const mockDurableObjectState = {
		id: { toString: () => "mock-do-id" },
		blockConcurrencyWhile: async <T>( cb: () => Promise<T> ) => cb()
	} as DurableObjectState;

	const mockEnv = {
		WORDLE_KV: {
			get: vi.fn(),
			put: vi.fn()
		}
	};

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "GamePlay: Error Scenarios", () => {
		const playerId = "player-1";
		const engine = new MockWordleEngine( mockDurableObjectState, mockEnv as unknown as Bindings );

		it.sequential( "should initialize the game with default word count and word length", async () => {
			await engine.initialize( {}, playerId );
			const { data } = await engine.getPlayerData( playerId );

			expect( data ).toBeDefined();
			expect( data?.wordCount ).toBe( 2 );
			expect( data?.wordLength ).toBe( 5 );

			expect( mockEnv.WORDLE_KV.put ).toHaveBeenCalledWith( expect.stringContaining( "gameId:" ), "mock-do-id" );
			expect( mockEnv.WORDLE_KV.put ).toHaveBeenCalledWith( "mock-do-id", expect.any( String ) );
		} );

		it.sequential( "should set words for the game", async () => {
			engine.setWords( [ "apple", "grape" ] );
		} );

		it.sequential( "should throw error when player not part of the game", async () => {
			const { error } = await engine.getPlayerData( "unknown-player" );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Player is not part of this game!" );
		} );

		it.sequential( "should omit words from player data", async () => {
			const { data } = await engine.getPlayerData( playerId );
			expect( data ).toBeDefined();
			expect( ( data as any ).words ).toBeUndefined();
		} );

		it.sequential( "should return error while getting words if game is not completed", async () => {
			const { error } = await engine.getWords( playerId );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Cannot show words before completion!" );
		} );

		it.sequential( "should return error if unknown player requests words", async () => {
			const { error } = await engine.getWords( "unknown-player" );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Player is not part of this game!" );
		} );

		it.sequential( "should return error if guess is not in dictionary", async () => {
			const { error } = await engine.makeGuess( { guess: "zzzzz" }, playerId );
			expect( error ).toBeDefined();
			expect( error ).toBe( "The guess is not a valid word" );
		} );

		it.sequential( "should return error if unknown player makes a guess", async () => {
			const { error } = await engine.makeGuess( { guess: "apple" }, "unknown-player" );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Player is not part of this game!" );
		} );

		it.sequential( "should mark game as completed if max guesses reached", async () => {
			for ( let i = 0; i < 7; i++ ) {
				await engine.makeGuess( { guess: "apple" }, playerId );
			}
			const { data } = await engine.getPlayerData( playerId );
			expect( data ).toBeDefined();
			expect( data?.completed ).toBe( true );
		} );

		it.sequential( "should return error if no guesses left", async () => {
			const { error } = await engine.makeGuess( { guess: "grape" }, playerId );
			expect( error ).toBeDefined();
			expect( error ).toBe( "No more guesses left" );
		} );
	} );

	describe( "GamePlay: Happy Path", () => {
		const playerId = "player-1";
		let engine: MockWordleEngine;

		it.sequential( "should load existing data from kv", async () => {
			const existingData = {
				id: "mock-do-id",
				playerId: playerId,
				wordCount: 2,
				wordLength: 5,
				words: [],
				guesses: [],
				guessBlocks: [],
				completedWords: [],
				completed: false
			};
			mockEnv.WORDLE_KV.get.mockResolvedValueOnce( existingData as any );
			engine = new MockWordleEngine( mockDurableObjectState, mockEnv as unknown as Bindings );

			expect( mockEnv.WORDLE_KV.get ).toHaveBeenCalledWith( "mock-do-id", "json" );
		} );

		it.sequential( "should initialize the game with provided word count and word length", async () => {
			await engine.initialize( { wordCount: 3, wordLength: 5 }, playerId );
			const { data } = await engine.getPlayerData( playerId );

			expect( data ).toBeDefined();
			expect( data?.wordCount ).toBe( 3 );
			expect( data?.wordLength ).toBe( 5 );

			expect( mockEnv.WORDLE_KV.put ).toHaveBeenCalledWith( expect.stringContaining( "gameId:" ), "mock-do-id" );
			expect( mockEnv.WORDLE_KV.put ).toHaveBeenCalledWith( "mock-do-id", expect.any( String ) );
		} );

		it.sequential( "should add guess and mark completed words if correct", async () => {
			engine.setWords( [ "apple", "grape", "peach" ] );

			let response = await engine.makeGuess( { guess: "apple" }, playerId );
			expect( response.error ).toBeUndefined();
			expect( response.data?.completedWords ).toContain( "apple" );

			response = await engine.makeGuess( { guess: "grape" }, playerId );
			expect( response.error ).toBeUndefined();
			expect( response.data?.completedWords ).toContain( "grape" );

			response = await engine.makeGuess( { guess: "peach" }, playerId );
			expect( response.error ).toBeUndefined();
			expect( response.data?.completedWords ).toContain( "peach" );
		} );

		it.sequential( "should mark game as completed if all words guessed", async () => {
			const { data } = await engine.getPlayerData( playerId );
			expect( data ).toBeDefined();
			expect( data?.completed ).toBe( true );
		} );

		it.sequential( "should return words after game completion", async () => {
			const { data, error } = await engine.getWords( playerId );
			expect( error ).toBeUndefined();
			expect( data ).toEqual( [ "apple", "grape", "peach" ] );
		} );
	} );
} );
