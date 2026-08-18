import { describe, expect, test } from "bun:test";

import { dictionaries } from "@/games/wordle/shared/dictionary.ts";
import {
	boardFor,
	computeRow,
	guessesOf,
	guessesSpentBy,
	hasFinished,
	isValidWord,
	lettersUsed,
	maxGuessesFor,
	normalizeGuess,
	resultsFor,
	scoreFor,
	solvedCountFor,
	solvedWordsFor,
	solvePoints
} from "@/games/wordle/server/utils.ts";
import { PlayerAudience, PlayerId, TableAudience } from "@/swish/shared/schema.ts";

import type { WordleConfig, WordleState } from "@/games/wordle/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b ] = [ player( "a" ), player( "b" ) ];

const configOf = ( over: Partial<WordleConfig> = {} ): WordleConfig => ( {
	playerCount: 2,
	autoStart: false,
	wordCount: 1,
	wordLength: 5,
	...over
} );

const stateOf = ( over: Partial<WordleState> = {} ): WordleState => ( {
	words: [ "crane" ],
	guesses: {},
	forfeited: [],
	decided: false,
	...over
} );


describe( "the guess allowance", () => {
	test( "is one per hidden word on top of the classic allowance", () => {
		expect( maxGuessesFor( configOf() ) ).toBe( 6 );
		expect( maxGuessesFor( configOf( { wordCount: 3 } ) ) ).toBe( 8 );
		expect( maxGuessesFor( configOf( { wordLength: 6, wordCount: 2 } ) ) ).toBe( 8 );
	} );
} );


describe( "reading a seat's guesses", () => {
	test( "a seat that has not guessed reads as empty rather than absent", () => {
		// `setup` runs before anyone has joined, so it cannot seed player keys —
		// and indexing types as a present array while handing back `undefined`.
		expect( guessesOf( stateOf(), a ) ).toEqual( [] );
	} );

	test( "a seat that has guessed reads them back in order", () => {
		const state = stateOf( { guesses: { [ a ]: [ "slate", "crane" ] } } );

		expect( guessesOf( state, a ) ).toEqual( [ "slate", "crane" ] );
	} );
} );


describe( "normalizing a guess", () => {
	test( "trims and lowercases, so a client typing in caps is not refused", () => {
		expect( normalizeGuess( "  CRANE " ) ).toBe( "crane" );
	} );

	test( "leaves a guess already in dictionary form alone", () => {
		expect( normalizeGuess( "crane" ) ).toBe( "crane" );
	} );
} );


describe( "checking a guess against the dictionary", () => {
	test( "accepts a word filed under that length", () => {
		expect( isValidWord( dictionaries[ 5 ][ 0 ]!, 5 ) ).toBe( true );
	} );

	test( "refuses a word that is not in it", () => {
		expect( isValidWord( "zzzzz", 5 ) ).toBe( false );
	} );

	test( "refuses a word of the wrong length for the table", () => {
		expect( isValidWord( dictionaries[ 5 ][ 0 ]!, 4 ) ).toBe( false );
	} );

	test( "every dictionary is lowercase and filed under its own length", () => {
		// `setup` draws answers from these lists, so a misfiled word would hide an
		// answer no legal guess of that length could ever match.
		for ( const [ length, words ] of Object.entries( dictionaries ) ) {
			expect( words.every( word => word.length === Number( length ) ) ).toBe( true );
			expect( words.every( word => word === word.toLowerCase() ) ).toBe( true );
		}
	} );
} );


describe( "scoring one guess against one word", () => {
	test( "marks every position of an exact match correct", () => {
		expect( computeRow( "crane", "crane" ) )
			.toEqual( [ "correct", "correct", "correct", "correct", "correct" ] );
	} );

	test( "marks a letter in the wrong place as present", () => {
		expect( computeRow( "acorn", "crane" ) )
			.toEqual( [ "present", "present", "absent", "present", "present" ] );
	} );

	test( "marks a letter the word does not hold as absent", () => {
		expect( computeRow( "juxta", "crane" ) )
			.toEqual( [ "absent", "absent", "absent", "absent", "present" ] );
	} );

	test( "a doubled guess letter against a single one in the word marks once", () => {
		// `crane` holds one `e`, so the first of the two claims it and the second
		// has nothing left to match.
		expect( computeRow( "green", "crane" ) )
			.toEqual( [ "absent", "correct", "present", "absent", "present" ] );
	} );

	test( "an exact match takes the letter before a misplaced copy can", () => {
		// The `e` in position 4 matches outright, so the earlier copies are absent
		// even though the word does hold an `e`.
		expect( computeRow( "melee", "crane" ) )
			.toEqual( [ "absent", "absent", "absent", "absent", "correct" ] );
	} );

	test( "returns one status per position of the word", () => {
		expect( computeRow( "aback", "aback" ) ).toHaveLength( 5 );
	} );
} );


describe( "a seat's columns", () => {
	test( "run to the guess that solved the word and stop there", () => {
		const state = stateOf( { guesses: { [ a ]: [ "slate", "crane", "adore" ] } } );
		const columns = resultsFor( state, a );

		expect( columns[ 0 ] ).toHaveLength( 2 );
	} );

	test( "run the whole way when the word is unsolved", () => {
		const state = stateOf( { guesses: { [ a ]: [ "slate", "adore" ] } } );

		expect( resultsFor( state, a )[ 0 ] ).toHaveLength( 2 );
	} );

	test( "index-align with the guesses that scored them", () => {
		const state = stateOf( { guesses: { [ a ]: [ "slate", "adore" ] } } );
		const column = resultsFor( state, a )[ 0 ]!;

		expect( column[ 0 ] ).toEqual( computeRow( "slate", "crane" ) );
		expect( column[ 1 ] ).toEqual( computeRow( "adore", "crane" ) );
	} );

	test( "there is one column per hidden word", () => {
		const state = stateOf( {
			words: [ "crane", "adore" ],
			guesses: { [ a ]: [ "slate" ] }
		} );

		expect( resultsFor( state, a ) ).toHaveLength( 2 );
	} );
} );


describe( "what a seat has solved", () => {
	test( "a word is solved by being guessed outright", () => {
		const state = stateOf( {
			words: [ "crane", "adore" ],
			guesses: { [ a ]: [ "slate", "crane" ] }
		} );

		expect( solvedWordsFor( state, a ) ).toEqual( [ true, false ] );
		expect( solvedCountFor( state, a ) ).toBe( 1 );
	} );

	test( "a seat that has guessed nothing has solved nothing", () => {
		expect( solvedCountFor( stateOf(), a ) ).toBe( 0 );
	} );
} );


describe( "the alphabet a seat has spent", () => {
	test( "counts distinct letters across every guess", () => {
		expect( lettersUsed( [ "crane", "acorn" ] ) ).toBe( 6 );
	} );

	test( "repeating a letter costs nothing", () => {
		expect( lettersUsed( [ "eerie" ] ) ).toBe( 3 );
	} );

	test( "no guesses spend nothing", () => {
		expect( lettersUsed( [] ) ).toBe( 0 );
	} );
} );


describe( "what a seat is charged for", () => {
	test( "the guesses it actually played", () => {
		const state = stateOf( { guesses: { [ a ]: [ "slate", "adore" ] } } );

		expect( guessesSpentBy( state, configOf(), a ) ).toBe( 2 );
	} );

	test( "a forfeit is charged the whole allowance, however few it played", () => {
		// Giving up gives the remainder up rather than banking it, which is what
		// stops a table being ended cheaply.
		const state = stateOf( { guesses: { [ a ]: [ "slate" ] }, forfeited: [ a ] } );

		expect( guessesSpentBy( state, configOf(), a ) ).toBe( maxGuessesFor( configOf() ) );
	} );
} );


describe( "whether a seat is done", () => {
	test( "a seat that solved every word is", () => {
		const state = stateOf( { guesses: { [ a ]: [ "crane" ] } } );

		expect( hasFinished( state, configOf(), a ) ).toBe( true );
	} );

	test( "a seat with allowance left and words outstanding is not", () => {
		const state = stateOf( { guesses: { [ a ]: [ "slate" ] } } );

		expect( hasFinished( state, configOf(), a ) ).toBe( false );
	} );

	test( "a seat that spent its allowance is", () => {
		const state = stateOf( {
			guesses: { [ a ]: [ "slate", "adore", "acorn", "abbey", "abbot", "abhor" ] }
		} );

		expect( hasFinished( state, configOf(), a ) ).toBe( true );
	} );

	test( "a seat that forfeited is, through the charge alone", () => {
		const state = stateOf( { forfeited: [ a ] } );

		expect( hasFinished( state, configOf(), a ) ).toBe( true );
	} );
} );


describe( "scoring a seat", () => {
	test( "a seat that solved nothing scores zero rather than its penalty", () => {
		// Otherwise every guess would carry negative value, and refusing to play
		// would win on a board nobody cracks.
		const state = stateOf( { guesses: { [ a ]: [ "slate", "adore" ] } } );

		expect( scoreFor( state, configOf(), a ) ).toBe( 0 );
	} );

	test( "solving a word always beats any efficiency advantage", () => {
		const config = configOf( { wordCount: 2 } );
		const solved = stateOf( {
			words: [ "crane", "adore" ],
			guesses: { [ a ]: [ "slate", "adore", "acorn", "abbey", "abbot", "abhor", "crane" ] }
		} );

		// One solve, at the maximum penalty, still beats none at no penalty.
		expect( scoreFor( solved, config, a ) ).toBeGreaterThan( 0 );
		expect( solvePoints( config ) ).toBeGreaterThan(
			config.wordLength * maxGuessesFor( config ) + 26
		);
	} );

	test( "a faster solve outscores a slower one", () => {
		const quick = stateOf( { guesses: { [ a ]: [ "crane" ] } } );
		const slow = stateOf( { guesses: { [ a ]: [ "slate", "adore", "crane" ] } } );

		expect( scoreFor( quick, configOf(), a ) )
			.toBeGreaterThan( scoreFor( slow, configOf(), a ) );
	} );

	test( "a forfeit after solving is charged the whole allowance", () => {
		const played = stateOf( { guesses: { [ a ]: [ "crane" ] } } );
		const gaveUp = stateOf( { guesses: { [ a ]: [ "crane" ] }, forfeited: [ a ] } );

		expect( scoreFor( gaveUp, configOf(), a ) )
			.toBeLessThan( scoreFor( played, configOf(), a ) );
	} );
} );


describe( "one seat's board, as an audience may read it", () => {
	const state = stateOf( { guesses: { [ a ]: [ "slate", "crane" ], [ b ]: [ "adore" ] } } );
	const data = { state, config: configOf(), context: undefined as never };

	test( "a seat reads its own rows", () => {
		const board = boardFor( data, a, PlayerAudience.make( { playerId: a } ) );

		expect( board.guesses ).toEqual( [ "slate", "crane" ] );
		expect( board.results[ 0 ] ).toHaveLength( 2 );
	} );

	test( "a rival's board is published as tallies alone", () => {
		// Every seat races the same words, so a rival's rows would be free scored
		// probes of a word you have not solved.
		const board = boardFor( data, b, PlayerAudience.make( { playerId: a } ) );

		expect( board.guesses ).toEqual( [] );
		expect( board.results ).toEqual( [] );
		expect( board.guessCount ).toBe( 1 );
	} );

	test( "the table reads nobody's rows while the game is on", () => {
		const board = boardFor( data, a, TableAudience.make( {} ) );

		expect( board.guesses ).toEqual( [] );
		expect( board.guessCount ).toBe( 2 );
	} );

	test( "a decided game opens every board to everyone", () => {
		const decided = { ...data, state: { ...state, decided: true } };
		const board = boardFor( decided, a, TableAudience.make( {} ) );

		expect( board.guesses ).toEqual( [ "slate", "crane" ] );
	} );

	test( "the tallies are populated whoever is reading", () => {
		const board = boardFor( data, a, TableAudience.make( {} ) );

		expect( board ).toMatchObject( {
			playerId: a,
			guessCount: 2,
			solvedWords: [ true ],
			finished: true
		} );
		expect( board.lettersUsed ).toBeGreaterThan( 0 );
		expect( board.score ).toBeGreaterThan( 0 );
	} );
} );
