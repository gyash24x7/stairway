import { describe, expect, test } from "bun:test";

import { allWordsGuessed, apply, computeRow } from "@/games/wordle/server/utils.ts";
import type { GuessResult, GuessResultsForWord } from "@/games/wordle/shared/schema.ts";
import { GuessedEvent, VictoryDecidedEvent } from "@/games/wordle/shared/schema.ts";


/** A row rendered as a compact status string, so an expectation reads like the board. */
const statuses = ( row: ReadonlyArray<GuessResult> ) => row.map( ( r ) => r.status ).join( " " );

/** The letters a row carries, in order — pins what `computeRow` echoes back. */
const letters = ( row: ReadonlyArray<GuessResult> ) => row.map( ( r ) => r.letter ).join( "" );

/** A genesis-shaped state: the words are chosen, nothing has been guessed yet. */
const stateOf = ( words: ReadonlyArray<string>, maxGuesses = 6 ) => ( {
	words,
	guesses: [] as ReadonlyArray<string>,
	guessResults: words.reduce<Record<string, GuessResultsForWord>>(
		( acc, word ) => ( { ...acc, [ word ]: [] } ),
		{}
	),
	maxGuesses
} );

// ===========================================================================
describe( "wordle utils — computeRow (letter scoring)", () => {

	test( "an exact guess is correct in every position", () => {
		const row = computeRow( "crane", "crane" );
		expect( statuses( row ) ).toBe( "correct correct correct correct correct" );
		expect( letters( row ) ).toBe( "crane" );
	} );

	test( "a guess sharing no letters is absent in every position", () => {
		expect( statuses( computeRow( "moldy", "crane" ) ) )
			.toBe( "absent absent absent absent absent" );
	} );

	test( "a right letter in the wrong place is present, not correct", () => {
		// a is in `crane` but not at index 0; r and e sit in the same slot in both.
		expect( statuses( computeRow( "arose", "crane" ) ) )
			.toBe( "present correct absent absent correct" );
	} );

	test( "the guessed letters are echoed back unchanged", () => {
		expect( letters( computeRow( "adieu", "crane" ) ) ).toBe( "adieu" );
	} );

	// --- duplicate letters: the pass-1/pass-2 pool is the whole game ---------

	test( "a doubled guess letter only scores as often as the word contains it", () => {
		// `apple` holds two p's and one each of a/l/e. `paper` spends the second p
		// on the exact match at index 2, leaving one p for the loose match at 0.
		expect( statuses( computeRow( "paper", "apple" ) ) )
			.toBe( "present present correct present absent" );
	} );

	test( "a correct match consumes the pool before any present match is scored", () => {
		// `crane` has a single e, claimed by the exact match at index 4 in pass 1;
		// the two earlier e's therefore find an empty pool and stay absent.
		expect( statuses( computeRow( "eerie", "crane" ) ) )
			.toBe( "absent absent present absent correct" );
	} );

	test( "a doubled guess letter against a single occurrence marks only the first", () => {
		// One a in `crane`; the leftmost loose a takes it, the second gets nothing.
		expect( statuses( computeRow( "aroma", "crane" ) ) )
			.toBe( "present correct absent absent absent" );
	} );

	test( "a doubled word letter can be scored twice by a doubled guess", () => {
		// Both e's of `sleep` are available: index 3 matches exactly, index 1 loosely.
		expect( statuses( computeRow( "renew", "sleep" ) ) )
			.toBe( "absent present absent correct absent" );
	} );

	test( "scoring is sized by the word, so a longer guess is truncated", () => {
		const row = computeRow( "cranes", "crane" );
		expect( row ).toHaveLength( 5 );
		expect( statuses( row ) ).toBe( "correct correct correct correct correct" );
	} );

	test( "a short guess pads the missing positions with empty absent cells", () => {
		const row = computeRow( "cra", "crane" );
		expect( row ).toHaveLength( 5 );
		expect( letters( row ) ).toBe( "cra" );
		expect( statuses( row ) ).toBe( "correct correct correct absent absent" );
	} );

	test( "scoring is pure — the same inputs always score the same", () => {
		expect( computeRow( "paper", "apple" ) ).toEqual( computeRow( "paper", "apple" ) );
	} );
} );

// ===========================================================================
describe( "wordle utils — allWordsGuessed", () => {

	test( "is false while any word is unguessed", () => {
		const state = { ...stateOf( [ "crane", "apple" ] ), guesses: [ "crane" ] };
		expect( allWordsGuessed( state ) ).toBe( false );
	} );

	test( "is true once every word appears in the guess list", () => {
		const state = { ...stateOf( [ "crane", "apple" ] ), guesses: [ "crane", "moldy", "apple" ] };
		expect( allWordsGuessed( state ) ).toBe( true );
	} );

	test( "is vacuously true for a game with no words", () => {
		expect( allWordsGuessed( stateOf( [] ) ) ).toBe( true );
	} );
} );

// ===========================================================================
describe( "wordle utils — apply (the reducer)", () => {

	test( "a Guessed event records the guess and one row per word", () => {
		const state = stateOf( [ "crane", "apple" ] );
		const rows = state.words.map( ( word ) => computeRow( "paper", word ) );
		const next = apply( state, GuessedEvent.make( { guess: "paper", rows } ) );

		expect( next.guesses ).toEqual( [ "paper" ] );
		expect( next.guessResults[ "crane" ] ).toHaveLength( 1 );
		expect( statuses( next.guessResults[ "apple" ]![ 0 ]! ) )
			.toBe( "present present correct present absent" );
	} );

	test( "rows are matched to words positionally", () => {
		const state = stateOf( [ "crane", "apple" ] );
		const rows = state.words.map( ( word ) => computeRow( "crane", word ) );
		const next = apply( state, GuessedEvent.make( { guess: "crane", rows } ) );

		expect( statuses( next.guessResults[ "crane" ]![ 0 ]! ) )
			.toBe( "correct correct correct correct correct" );
		expect( statuses( next.guessResults[ "apple" ]![ 0 ]! ) )
			.toBe( "absent absent present absent correct" );
	} );

	test( "successive guesses accumulate in order", () => {
		const state = stateOf( [ "crane" ] );
		const guessed = ( guess: string ) => GuessedEvent.make( {
			guess,
			rows: [ computeRow( guess, "crane" ) ]
		} );

		const next = apply( apply( state, guessed( "moldy" ) ), guessed( "crane" ) );
		expect( next.guesses ).toEqual( [ "moldy", "crane" ] );
		expect( next.guessResults[ "crane" ] ).toHaveLength( 2 );
	} );

	test( "a VictoryDecided event sets the victory flag", () => {
		expect( apply(
			stateOf( [ "crane" ] ),
			VictoryDecidedEvent.make( { victory: true } )
		).victory ).toBe( true );

		expect( apply(
			stateOf( [ "crane" ] ),
			VictoryDecidedEvent.make( { victory: false } )
		).victory ).toBe( false );
	} );

	test( "the reducer never mutates the state it was handed", () => {
		const state = stateOf( [ "crane" ] );
		apply( state, GuessedEvent.make( { guess: "crane", rows: [ computeRow( "crane", "crane" ) ] } ) );

		expect( state.guesses ).toEqual( [] );
		expect( state.guessResults[ "crane" ] ).toEqual( [] );
	} );

	test( "the reducer is deterministic — folding the same events twice agrees", () => {
		const state = stateOf( [ "crane", "apple" ] );
		const events = [ "paper", "moldy", "crane" ].map( ( guess ) => GuessedEvent.make( {
			guess,
			rows: state.words.map( ( word ) => computeRow( guess, word ) )
		} ) );

		const fold = () => events.reduce( apply, state );
		expect( fold() ).toEqual( fold() );
	} );
} );
