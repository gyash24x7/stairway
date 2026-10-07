import { assert, describe, it } from "@effect/vitest";

import { dictionaries } from "@/games/wordle/dictionary";
import type { WordleConfig, WordleState } from "@/games/wordle/schema";
import { WordleConfig as Config } from "@/games/wordle/schema";
import {
	computeRow,
	guessesOf,
	guessesSpentBy,
	hasFinished,
	isValidWord,
	lettersUsed,
	maxGuessesFor,
	nextUnfinishedSeat,
	normalizeGuess,
	resultsFor,
	scoreFor,
	solvedCountFor,
	solvedWordsFor,
	solvePoints
} from "@/games/wordle/utils";
import type { GameContext, PlayerId } from "@/swish/schema";
import { GameContext as Context } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;

const config = ( overrides: Partial<WordleConfig> = {} ): WordleConfig => Config.make( {
	playerCount: 2,
	wordCount: 1,
	wordLength: 5,
	autoStart: true,
	botDelayMillis: 5_000,
	moveTimeoutMillis: 180_000,
	...overrides
} );

const state = ( overrides: Partial<WordleState> = {} ): WordleState => ( {
	words: [ "crane" ],
	guesses: {},
	forfeited: [],
	decided: false,
	...overrides
} );

const context = ( players: ReadonlyArray<PlayerId> ): GameContext => Context.make( {
	turn: 0,
	players,
	teams: {},
	teamNames: {},
	interactions: [],
	interactionCount: 0
} );


describe( "wordle utils", () => {

	describe( "normalizeGuess", () => {

		it( "lowercases and trims, because the dictionary is lowercase", () => {
			assert.strictEqual( normalizeGuess( "  CRANE " ), "crane" );
			assert.strictEqual( normalizeGuess( "CrAnE" ), "crane" );
		} );
	} );

	describe( "isValidWord", () => {

		it( "accepts a word filed under its own length", () => {
			assert.isTrue( isValidWord( "crane", 5 ) );
		} );

		it( "refuses a word of the wrong length for the table", () => {
			assert.isFalse( isValidWord( "crane", 4 ) );
		} );

		it( "refuses something that is not a word at all", () => {
			assert.isFalse( isValidWord( "zzzzz", 5 ) );
		} );

		it( "refuses a guess that was not normalized first", () => {
			// The gate is a set lookup, so the caller owes it lowercase.
			assert.isFalse( isValidWord( "CRANE", 5 ) );
		} );

		it( "holds every answer it could ever draw", () => {
			// `setup` draws from the same lists it validates against, so a misfiled
			// word would hide an answer no legal guess of that length could match.
			for ( const [ length, words ] of Object.entries( dictionaries ) ) {
				for ( const word of words ) {
					assert.strictEqual( word, word.toLowerCase(), word );
					assert.strictEqual( word.length, Number( length ), word );
				}
			}
		} );
	} );

	describe( "maxGuessesFor", () => {

		it( "gives one guess per word on top of the classic allowance", () => {
			assert.strictEqual( maxGuessesFor( config( { wordCount: 1, wordLength: 5 } ) ), 6 );
			assert.strictEqual( maxGuessesFor( config( { wordCount: 4, wordLength: 5 } ) ), 9 );
			assert.strictEqual( maxGuessesFor( config( { wordCount: 2, wordLength: 6 } ) ), 8 );
		} );
	} );

	describe( "guessesOf", () => {

		it( "reads a seat that has never guessed as empty, not as undefined", () => {
			assert.deepStrictEqual( guessesOf( state(), alice ), [] );
		} );
	} );

	describe( "computeRow", () => {

		it( "marks an exact match correct all the way across", () => {
			assert.deepStrictEqual(
				computeRow( "crane", "crane" ),
				[ "correct", "correct", "correct", "correct", "correct" ]
			);
		} );

		it( "marks a letter the word does not hold absent", () => {
			assert.deepStrictEqual(
				computeRow( "spout", "crane" ),
				[ "absent", "absent", "absent", "absent", "absent" ]
			);
		} );

		it( "spends the pool once per copy the word holds", () => {
			// "crane" holds one "e". The correct match at the end takes it, so both
			// leading copies find the pool empty. The "r" is present on its own merits.
			assert.deepStrictEqual(
				computeRow( "eerie", "crane" ),
				[ "absent", "absent", "present", "absent", "correct" ]
			);
		} );

		it( "lets a correct match consume the copy before any present one can", () => {
			const row = computeRow( "alaska", "alpaca" );
			assert.strictEqual( row[ 0 ], "correct" );
			assert.strictEqual( row[ 1 ], "correct" );
			assert.strictEqual( row[ 5 ], "correct" );
		} );

		it( "scores one status per position, always", () => {
			assert.strictEqual( computeRow( "crane", "abbey" ).length, 5 );
		} );

		it( "marks a misplaced letter present", () => {
			// "e" is in "crane", but not at position 0.
			assert.strictEqual( computeRow( "elbow", "crane" )[ 0 ], "present" );
		} );
	} );

	describe( "resultsFor", () => {

		it( "gives one column per hidden word", () => {
			const table = state( {
				words: [ "crane", "abbey" ],
				guesses: { [ alice ]: [ "spout" ] }
			} );

			assert.strictEqual( resultsFor( table, alice ).length, 2 );
		} );

		it( "stops a column at the guess that solved its word", () => {
			const table = state( {
				words: [ "crane", "abbey" ],
				guesses: { [ alice ]: [ "spout", "crane", "abbey" ] }
			} );

			const [ crane, abbey ] = resultsFor( table, alice );

			// Never padded out: `results[ w ][ i ]` is always the row for `guesses[ i ]`,
			// and a short column is what tells a client the word is done.
			assert.strictEqual( crane?.length, 2 );
			assert.strictEqual( abbey?.length, 3 );
		} );

		it( "keeps every row for a word still unsolved", () => {
			const table = state( { guesses: { [ alice ]: [ "spout", "abbey" ] } } );
			assert.strictEqual( resultsFor( table, alice )[ 0 ]?.length, 2 );
		} );
	} );

	describe( "solvedWordsFor", () => {

		it( "reports a solve per word, in the order they were drawn", () => {
			const table = state( {
				words: [ "crane", "abbey" ],
				guesses: { [ alice ]: [ "abbey" ] }
			} );

			assert.deepStrictEqual( solvedWordsFor( table, alice ), [ false, true ] );
			assert.strictEqual( solvedCountFor( table, alice ), 1 );
		} );
	} );

	describe( "lettersUsed", () => {

		it( "counts distinct letters, not typing", () => {
			assert.strictEqual( lettersUsed( [ "abbey" ] ), 4 );
			assert.strictEqual( lettersUsed( [ "abbey", "abbey" ] ), 4 );
		} );

		it( "pools across guesses", () => {
			assert.strictEqual( lettersUsed( [ "crane", "crane" ] ), 5 );
			assert.strictEqual( lettersUsed( [] ), 0 );
		} );
	} );

	describe( "guessesSpentBy", () => {

		it( "charges a playing seat what it actually played", () => {
			const table = state( { guesses: { [ alice ]: [ "spout", "crane" ] } } );
			assert.strictEqual( guessesSpentBy( table, config(), alice ), 2 );
		} );

		it( "charges a forfeited seat the whole allowance", () => {
			// Giving up gives the remainder up rather than banking it, which is what
			// stops a hard board being ended cheaply.
			const table = state( { guesses: { [ alice ]: [ "spout" ] }, forfeited: [ alice ] } );
			assert.strictEqual( guessesSpentBy( table, config(), alice ), 6 );
		} );
	} );

	describe( "hasFinished", () => {

		it( "is false for a seat with allowance and words left", () => {
			assert.isFalse( hasFinished( state(), config(), alice ) );
		} );

		it( "is true once every word is solved", () => {
			const table = state( { guesses: { [ alice ]: [ "crane" ] } } );
			assert.isTrue( hasFinished( table, config(), alice ) );
		} );

		it( "is true once the allowance is spent", () => {
			const table = state( {
				guesses: { [ alice ]: [ "spout", "abbey", "aback", "abase", "abate", "abbot" ] }
			} );

			assert.isTrue( hasFinished( table, config(), alice ) );
		} );

		it( "is true for a seat that gave up", () => {
			assert.isTrue( hasFinished( state( { forfeited: [ alice ] } ), config(), alice ) );
		} );
	} );

	describe( "nextUnfinishedSeat", () => {

		const data = ( table: WordleState, players: ReadonlyArray<PlayerId> ) => ( {
			state: table,
			config: config( { playerCount: players.length } ),
			context: context( players )
		} );

		it( "rotates to the next seat", () => {
			assert.strictEqual(
				nextUnfinishedSeat( data( state(), [ alice, bob, carol ] ), alice ),
				bob
			);
		} );

		it( "wraps around the table", () => {
			assert.strictEqual( nextUnfinishedSeat( data( state(), [ alice, bob ] ), bob ), alice );
		} );

		it( "skips a seat that has nothing left to play", () => {
			const table = state( { guesses: { [ bob ]: [ "crane" ] } } );
			assert.strictEqual(
				nextUnfinishedSeat( data( table, [ alice, bob, carol ] ), alice ),
				carol
			);
		} );

		it( "hands the cursor back when nobody is left to play", () => {
			// `endIf` is asked immediately after, and ends the game.
			const table = state( { forfeited: [ alice, bob ] } );
			assert.strictEqual( nextUnfinishedSeat( data( table, [ alice, bob ] ), alice ), alice );
		} );

		it( "stays put in solitaire while there is still a guess left", () => {
			assert.strictEqual( nextUnfinishedSeat( data( state(), [ alice ] ), alice ), alice );
		} );
	} );

	describe( "scoreFor", () => {

		it( "scores a seat that solved nothing at zero, not at its penalty", () => {
			// Otherwise every guess carries negative value and refusing to play wins.
			const table = state( { guesses: { [ alice ]: [ "spout", "abbey" ] } } );
			assert.strictEqual( scoreFor( table, config(), alice ), 0 );
		} );

		it( "pays for a solve, less what it cost to get there", () => {
			const cfg = config();
			const table = state( { guesses: { [ alice ]: [ "crane" ] } } );

			assert.strictEqual(
				scoreFor( table, cfg, alice ),
				solvePoints( cfg ) - cfg.wordLength - 5
			);
		} );

		it( "rewards getting there in fewer guesses", () => {
			const cfg = config();
			const quick = state( { guesses: { [ alice ]: [ "crane" ] } } );
			const slow = state( { guesses: { [ alice ]: [ "spout", "crane" ] } } );

			assert.isAbove( scoreFor( quick, cfg, alice ), scoreFor( slow, cfg, alice ) );
		} );

		it( "lets an extra word solved beat any efficiency advantage", () => {
			// The score packs a lexicographic order into one integer, by construction
			// rather than by a tuned constant.
			const cfg = config( { wordCount: 2 } );

			const thorough = state( {
				words: [ "crane", "abbey" ],
				guesses: { [ alice ]: [ "spout", "aback", "abase", "crane", "abbey" ] }
			} );
			const neat = state( {
				words: [ "crane", "abbey" ],
				guesses: { [ alice ]: [ "crane" ] }
			} );

			assert.isAbove( scoreFor( thorough, cfg, alice ), scoreFor( neat, cfg, alice ) );
		} );

		it( "charges a forfeited seat the whole allowance", () => {
			const cfg = config();
			const played = state( { guesses: { [ alice ]: [ "crane" ] } } );
			const gaveUp = state( { guesses: { [ alice ]: [ "crane" ] }, forfeited: [ alice ] } );

			assert.isBelow( scoreFor( gaveUp, cfg, alice ), scoreFor( played, cfg, alice ) );
		} );

		it( "never goes negative", () => {
			const cfg = config();
			const table = state( {
				guesses: { [ alice ]: [ "spout", "abbey", "aback", "abase", "abate", "abbot" ] },
				forfeited: [ alice ]
			} );

			assert.isAtLeast( scoreFor( table, cfg, alice ), 0 );
		} );

		it( "keeps one solve above the worst possible penalty", () => {
			// The invariant `solvePoints` exists for: a single solve must outrank
			// every efficiency term put together.
			const cfg = config( { wordCount: 2 } );
			const worst = cfg.wordLength * maxGuessesFor( cfg ) + 26;

			assert.isAbove( solvePoints( cfg ), worst );
		} );
	} );
} );
