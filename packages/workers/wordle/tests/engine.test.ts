import { beforeEach, describe, expect, it } from "bun:test";
import { WordleEngine } from "../src/engine";
import type { GameData } from "../src/types";

describe( "WordleEngine", () => {
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

	describe( "static create()", () => {
		it( "should initialize a new game with random words", () => {
			const engine = WordleEngine.create( {}, "player-1" );
			const playerData = engine.getPlayerData();

			expect( engine.id ).toBe( playerData.id );
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

			expect( playerData.guessBlocks.length ).toBe( 2 );
			expect( playerData.guessBlocks.flat().flat().every( pos => pos.state === "empty" ) ).toBe( true );
		} );
	} );

	describe( "getPlayerData()", () => {
		it( "should omit words from player data", () => {
			const engine = new WordleEngine( gameData );
			const playerData = engine.getPlayerData();
			expect( playerData ).not.toHaveProperty( "words" );
			expect( playerData ).toHaveProperty( "id", "game-1" );
		} );
	} );

	describe( "getWords()", () => {
		it( "should throw if game is not completed", () => {
			const engine = new WordleEngine( gameData );
			expect( () => engine.getWords() ).toThrow( /Cannot show words before completion/ );
		} );

		it( "should return words if game is completed", () => {
			gameData.completed = true;
			const engine = new WordleEngine( gameData );
			expect( engine.getWords() ).toEqual( [ "apple", "grape" ] );
		} );
	} );

	describe( "makeGuess()", () => {
		it( "should add guess and mark completedWords if correct", () => {
			const engine = new WordleEngine( gameData );
			engine.makeGuess( "apple" );

			const playerData = engine.getPlayerData();
			expect( playerData.guesses ).toContain( "apple" );
			expect( playerData.completedWords ).toContain( "apple" );
			expect( playerData.completed ).toBe( false );
			// For the first word, all letters should be correct
			expect( playerData.guessBlocks[ 0 ][ 0 ].every( pos => pos.state === "correct" ) ).toBe( true );
			// For the second word, states should be wrong or wrongPlace
			expect( playerData.guessBlocks[ 1 ][ 0 ].some( pos => [ "wrong", "wrongPlace" ].includes( pos.state ) ) )
				.toBe( true );

		} );

		it( "should mark game as completed if all words guessed", () => {
			const engine = new WordleEngine( gameData );
			engine.makeGuess( "apple" );
			engine.makeGuess( "grape" );
			expect( engine.getPlayerData().completed ).toBe( true );
		} );

		it( "should mark game as completed if max guesses reached", () => {
			const engine = new WordleEngine( gameData );
			for ( let i = 0; i < 7; i++ ) {
				engine.makeGuess( "apple" );
			}
			expect( engine.getPlayerData().completed ).toBe( true );
		} );

		it( "should throw if guess is not in dictionary", () => {
			const engine = new WordleEngine( gameData );
			expect( () => engine.makeGuess( "zzzzz" ) ).toThrow( /not a valid word/ );
		} );

		it( "should throw if no guesses left", () => {
			const engine = new WordleEngine( { ...gameData, guesses: Array( 7 ).fill( "apple" ) } );
			expect( () => engine.makeGuess( "apple" ) ).toThrow( /No more guesses left/ );
		} );
	} );
} );
