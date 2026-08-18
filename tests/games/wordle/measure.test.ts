import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { wordle } from "@/games/wordle/server/engine.ts";
import { GameCode, GameId, PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { TestHost } from "@tests/helpers/host.ts";

import type { UserId } from "@/auth/shared/schema.ts";
import type { WordCount, WordLength } from "@/games/wordle/shared/schema.ts";

/**
 * Plays one table out with every seat machine-played, and reports what the
 * policy managed on it.
 *
 * The clock is parked a day ahead of the one the engine arms its timers off, so
 * every wake-up is already due and the run is a sequence of `alarm()` calls
 * rather than a wait.
 *
 * @param run - Which run this is, so each table gets an id of its own.
 * @param wordCount - How many words the table hides.
 * @param wordLength - How long each of them is.
 * @returns What the seat solved, spent and scored.
 */
const play = ( run: number, wordCount: WordCount, wordLength: WordLength ) => {
	const now = () => Date.now() + 24 * 60 * 60 * 1000;

	const program = Effect.gen( function* () {
		const engine = yield* wordle;
		const seat = PlayerId.make( "p0" );

		yield* engine.initialize( {
			id: GameId.make( `game-${ run }` ),
			code: GameCode.make( "CODE" ),
			creator: seat as UserId,
			config: { playerCount: 1, autoStart: false, wordCount, wordLength }
		} );

		yield* engine.join(
			PlayerInfo.make( { id: seat, name: "bot", avatar: "a", isBot: true } )
		);

		yield* engine.start( seat );

		for ( let i = 0; i < 100; i++ ) {
			const view = yield* engine.getState();
			if ( view.status === "COMPLETED" ) {
				break;
			}

			yield* engine.alarm();
		}

		const view = yield* engine.getState( seat );
		const board = view.view.boards[ 0 ]!;

		return {
			solved: board.solvedWords.filter( Boolean ).length,
			words: wordCount,
			guesses: board.guessCount,
			allowance: view.view.maxGuesses,
			score: board.score,
			completed: view.status === "COMPLETED"
		};
	} ).pipe( Effect.provide( TestHost( { now } ) ) );

	return Effect.runSync( program );
};

describe( "measured behaviour", () => {
	test( "self-play statistics", () => {
		// The words are drawn from a seed generated at `initialize`, so every run
		// is a fresh board — these are the policy's numbers over real draws rather
		// than over one lucky word.
		const boards = [
			{ shape: "1 x 5", count: 1 as WordCount, length: 5 as WordLength },
			{ shape: "4 x 5", count: 4 as WordCount, length: 5 as WordLength },
			{ shape: "3 x 6", count: 3 as WordCount, length: 6 as WordLength },
			{ shape: "2 x 4", count: 2 as WordCount, length: 4 as WordLength }
		];

		const runs = boards.flatMap( ( board, index ) =>
			Array.from( { length: 20 } ).map( ( _, run ) => ( {
				shape: board.shape,
				...play( index * 1000 + run, board.count, board.length )
			} ) )
		);

		for ( const board of boards ) {
			const rows = runs.filter( row => row.shape === board.shape );
			const sum = ( pick: ( row: typeof rows[ number ] ) => number ) =>
				rows.reduce( ( total, row ) => total + pick( row ), 0 );

			console.log( board.shape, {
				games: rows.length,
				fullySolved: rows.filter( row => row.solved === row.words ).length,
				wordsSolved: `${ sum( r => r.solved ) }/${ sum( r => r.words ) }`,
				guessesSpent: ( sum( r => r.guesses ) / rows.length ).toFixed( 1 )
					+ `/${ rows[ 0 ]!.allowance }`,
				meanScore: ( sum( r => r.score ) / rows.length ).toFixed( 1 )
			} );
		}

		// Every table finishes: a bot that stops guessing holds the cursor, and the
		// table stalls behind it.
		expect( runs.every( row => row.completed ) ).toBe( true );

		// It never spends more than the allowance, and never gives up early — a
		// forfeit would show as a board finished under its allowance with words
		// left unsolved.
		expect( runs.every( row => row.guesses <= row.allowance ) ).toBe( true );
		expect( runs.every( row => row.solved === row.words || row.guesses === row.allowance ) )
			.toBe( true );

		// Solving is what the table scores, so the bar is on words solved rather
		// than on style: the single-word boards are the classic game at six
		// guesses, and the stacked ones are graded on the words they land.
		const solo = runs.filter( row => row.words === 1 );
		expect( solo.filter( row => row.solved === 1 ).length / solo.length )
			.toBeGreaterThanOrEqual( 0.9 );

		const stacked = runs.filter( row => row.words > 1 );
		const stackedSolved = stacked.reduce( ( total, row ) => total + row.solved, 0 );
		const stackedWords = stacked.reduce( ( total, row ) => total + row.words, 0 );
		expect( stackedSolved / stackedWords ).toBeGreaterThanOrEqual( 0.9 );
	}, 120_000 );
} );
