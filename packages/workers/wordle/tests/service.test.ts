import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mock, mockClear } from "vitest-mock-extended";
import { WordleService } from "../src/service.ts";
import type { GameData } from "../src/types.ts";

describe( "WordleService", () => {
	const kv = mock<KVNamespace>();
	const service = new WordleService( kv );
	let gameData: GameData;

	beforeEach( () => {
		gameData = {
			id: "game-1",
			playerId: "player-1",
			wordLength: 5,
			wordCount: 2,
			words: [ "apple", "grape" ],
			guesses: [],
			guessBlocks: [],
			completedWords: [],
			completed: false
		};
	} );

	afterEach( () => {
		mockClear( kv );
	} );

	describe( "createGame()", () => {
		it( "should create a new game, save it to KV and return player view", async () => {
			const playerData = await service.createGame( {}, "player-1" );

			expect( playerData ).toEqual(
				expect.objectContaining( {
					playerId: "player-1",
					wordLength: 5,
					wordCount: 2,
					guesses: [],
					completedWords: [],
					completed: false
				} )
			);

			expect( playerData.guessBlocks.length ).toEqual( 2 );
			expect( kv.put ).toHaveBeenCalledTimes( 1 );

			const [ savedKey, savedValue ] = kv.put.mock.calls[ 0 ];
			const saved = JSON.parse( savedValue as string );
			expect( saved.id ).toBe( savedKey );
			expect( saved.words ).toBeDefined();
		} );
	} );

	describe( "getGame()", () => {
		it( "should return player game info when game exists and player matches", async () => {
			kv.get.mockResolvedValue( JSON.stringify( gameData ) as any );
			const result = await service.getGame( gameData.id, "player-1" );
			expect( result ).not.toHaveProperty( "words" );
			expect( result ).toHaveProperty( "id", "game-1" );
		} );

		it( "should throw when game not found", async () => {
			kv.get.mockResolvedValue( null as any );
			await expect( service.getGame( "missing", "player-1" ) ).rejects.toThrow( /Game not found/ );
		} );

		it( "should throw when playerId does not match", async () => {
			const badOwner = { ...gameData, playerId: "other-player" };
			kv.get.mockResolvedValue( JSON.stringify( badOwner ) as any );
			await expect( service.getGame( gameData.id, "player-1" ) ).rejects.toThrow( /Game not found/ );
		} );
	} );

	describe( "makeGuess()", () => {
		it( "should apply a guess, persist updated state and return player data", async () => {
			kv.get.mockResolvedValue( JSON.stringify( gameData ) as any );
			const result = await service.makeGuess( { gameId: gameData.id, guess: "apple" }, "player-1" );

			expect( kv.put ).toHaveBeenCalledTimes( 1 );
			expect( result.guesses ).toContain( "apple" );
			// if the guessed word is correct it should appear in completedWords
			expect( result.completedWords ).toContain( "apple" );
		} );

		it( "should throw if game already completed", async () => {
			const completed = { ...gameData, completed: true };
			kv.get.mockResolvedValue( JSON.stringify( completed ) as any );
			await expect(
				service.makeGuess( { gameId: gameData.id, guess: "apple" }, "player-1" )
			).rejects.toThrow( /Game is already completed/ );
			expect( kv.put ).not.toHaveBeenCalled();
		} );
	} );

	describe( "getWords()", () => {
		it( "should return words for a completed game", async () => {
			const completed = { ...gameData, completed: true };
			kv.get.mockResolvedValue( JSON.stringify( completed ) as any );
			const words = await service.getWords( gameData.id, "player-1" );
			expect( words ).toEqual( [ "apple", "grape" ] );
		} );

		it( "should throw if game is not completed", async () => {
			kv.get.mockResolvedValue( JSON.stringify( gameData ) as any );
			await expect( service.getWords( gameData.id, "player-1" ) ).rejects.toThrow(
				/Cannot show words before completion/
			);
		} );
	} );
} );
