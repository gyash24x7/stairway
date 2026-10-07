import { assert, describe, it } from "@effect/vitest";

import { atPosition } from "@tests/harness/position";

import type { WordleConfig, WordleState } from "@/games/wordle/schema";
import { WordleConfig as Config } from "@/games/wordle/schema";
import { WordleStructure } from "@/games/wordle/server/engine";
import { maxGuessesFor, scoreFor } from "@/games/wordle/utils";
import type { PlayerId } from "@/swish/schema";
import { PlayerAudience, TableAudience } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;

const config = ( overrides: Partial<WordleConfig> = {} ): WordleConfig => Config.make( {
	playerCount: 2,
	wordCount: 1,
	wordLength: 5,
	autoStart: true,
	botDelayMillis: 5_000,
	moveTimeoutMillis: 180_000,
	...overrides
} );

const at = (
	state: Partial<WordleState> = {},
	overrides: Partial<WordleConfig> = {},
	players: ReadonlyArray<PlayerId> = [ alice, bob ]
) => atPosition( WordleStructure, {
	state: { words: [ "crane" ], guesses: {}, forfeited: [], decided: false, ...state },
	config: config( { playerCount: Math.max( 1, players.length ), ...overrides } ),
	context: { players, currentPlayer: players[ 0 ], turn: 0 }
} );

const spend = ( n: number ) =>
	[ "spout", "abbey", "aback", "abase", "abate", "abbot", "abhor", "abide" ].slice( 0, n );


describe( "wordle rules", () => {

	describe( "guess", () => {

		it( "accepts a word of the table's length", () => {
			assert.isUndefined( at().validate( "guess", alice, { guess: "spout" } ) );
		} );

		it( "accepts a guess in any case, with any space around it", () => {
			assert.isUndefined( at().validate( "guess", alice, { guess: "  SPOUT " } ) );
		} );

		it( "refuses the wrong length", () => {
			const invalid = at().validate( "guess", alice, { guess: "spot" } );
			assert.strictEqual( invalid?._tag, "swish/InvalidMove" );
			assert.include( invalid?.reason ?? "", "must be 5 letters" );
		} );

		it( "refuses a word the table does not know", () => {
			const invalid = at().validate( "guess", alice, { guess: "zzzzz" } );
			assert.include( invalid?.reason ?? "", "not a word this table knows" );
		} );

		it( "names the normalized form in the refusal", () => {
			const invalid = at().validate( "guess", alice, { guess: "ZZZZZ" } );
			assert.include( invalid?.reason ?? "", "\"zzzzz\"" );
		} );

		it( "refuses a seat that has already solved everything", () => {
			const game = at( { guesses: { [ alice ]: [ "crane" ] } } );
			const invalid = game.validate( "guess", alice, { guess: "spout" } );
			assert.include( invalid?.reason ?? "", "no guesses left" );
		} );

		it( "refuses a seat that has spent its allowance", () => {
			const game = at( { guesses: { [ alice ]: spend( 6 ) } } );
			assert.isDefined( game.validate( "guess", alice, { guess: "spout" } ) );
		} );

		it( "refuses a seat that gave up", () => {
			const game = at( { forfeited: [ alice ] } );
			assert.isDefined( game.validate( "guess", alice, { guess: "spout" } ) );
		} );

		it( "stores the normalized word, not what was typed", () => {
			// The rows are scored against it on every read, and the dictionary is
			// lowercase — storing the typed form would score as an unknown word.
			const game = at();
			game.apply( ...game.execute( "guess", alice, { guess: "  SPOUT " } ) );

			assert.deepStrictEqual( [ ...game.state.guesses[ alice ]! ], [ "spout" ] );
		} );

		it( "appends rather than replaces", () => {
			const game = at();
			game.play( "guess", alice, { guess: "spout" } );
			game.play( "guess", alice, { guess: "crane" } );

			assert.deepStrictEqual( [ ...game.state.guesses[ alice ]! ], [ "spout", "crane" ] );
		} );

		it( "keeps each seat's guesses to itself", () => {
			const game = at();
			game.play( "guess", alice, { guess: "spout" } );
			game.play( "guess", bob, { guess: "crane" } );

			assert.deepStrictEqual( [ ...game.state.guesses[ alice ]! ], [ "spout" ] );
			assert.deepStrictEqual( [ ...game.state.guesses[ bob ]! ], [ "crane" ] );
		} );
	} );

	describe( "canMove — the race", () => {

		it( "lets a seat play whoever the cursor is on", () => {
			// Without this every seat but one would be told it was not its turn, and
			// a table of people would take its guesses in single file.
			const game = at();
			assert.isTrue( game.canMove( "guess", alice ) );
			assert.isTrue( game.canMove( "guess", bob ) );
		} );

		it( "stops admitting a seat once it is finished", () => {
			const game = at( { guesses: { [ bob ]: [ "crane" ] } } );
			assert.isTrue( game.canMove( "guess", alice ) );
			assert.isFalse( game.canMove( "guess", bob ) );
		} );

		it( "applies the same rule to forfeiting", () => {
			const game = at( { forfeited: [ bob ] } );
			assert.isTrue( game.canMove( "forfeit", alice ) );
			assert.isFalse( game.canMove( "forfeit", bob ) );
		} );
	} );

	describe( "forfeit", () => {

		it( "records the seat and nothing else", () => {
			const game = at();
			const events = game.execute( "forfeit", alice, {} );

			assert.deepStrictEqual(
				events,
				[ { _tag: "wordle/ev/Forfeited", playerId: alice } ]
			);
		} );

		it( "retires the seat", () => {
			const game = at();
			game.play( "forfeit", alice, {} );
			assert.isDefined( game.validate( "guess", alice, { guess: "spout" } ) );
		} );

		it( "refuses a seat that has already finished", () => {
			const game = at( { guesses: { [ alice ]: [ "crane" ] } } );
			const invalid = game.validate( "forfeit", alice, {} );
			assert.include( invalid?.reason ?? "", "already finished" );
		} );

		it( "costs the rest of the allowance rather than banking it", () => {
			const cfg = config();
			const game = at();
			game.play( "guess", alice, { guess: "crane" } );

			const solved = scoreFor( game.state, cfg, alice );

			const other = at();
			other.play( "guess", alice, { guess: "crane" } );
			other.apply( { _tag: "wordle/ev/Forfeited", playerId: alice } );

			assert.isBelow( scoreFor( other.state, cfg, alice ), solved );
		} );
	} );

	describe( "endIf", () => {

		it( "keeps going while any seat can still play", () => {
			const game = at( { guesses: { [ alice ]: [ "crane" ] } } );
			assert.isFalse( game.endIf() );
		} );

		it( "ends once every seat is finished", () => {
			const game = at( { guesses: { [ alice ]: [ "crane" ], [ bob ]: [ "crane" ] } } );
			assert.isTrue( game.endIf() );
		} );

		it( "ends when the last unfinished seat gives up", () => {
			const game = at( { guesses: { [ alice ]: [ "crane" ] }, forfeited: [ bob ] } );
			assert.isTrue( game.endIf() );
		} );

		it( "does not call an empty table finished", () => {
			// `every` on an empty list is `true`; a table with no players has not
			// finished, it has not begun.
			const game = at( {}, {}, [] );
			assert.isFalse( game.endIf() );
		} );
	} );

	describe( "onEnd", () => {

		it( "unseals the answers and records no verdict", () => {
			const game = at();
			assert.deepStrictEqual( game.onEnd(), [ { _tag: "wordle/ev/Decided" } ] );

			game.apply( ...game.onEnd() );
			assert.isTrue( game.state.decided );
		} );
	} );

	describe( "resolveResults", () => {

		it( "ranks by score, highest first, and names a lone leader", () => {
			const game = at( {
				guesses: { [ alice ]: [ "crane" ], [ bob ]: [ "spout", "crane" ] }
			} );

			const results = game.results();
			assert.strictEqual( results?.winner, alice );
			assert.deepStrictEqual(
				results?.ranking.map( entry => [ entry.playerId, entry.rank ] ),
				[ [ alice, 1 ], [ bob, 2 ] ]
			);
		} );

		it( "lets a tie share a rank and names no winner", () => {
			const game = at( {
				guesses: { [ alice ]: [ "crane" ], [ bob ]: [ "crane" ] }
			} );

			const results = game.results();
			assert.isUndefined( results?.winner );
			assert.deepStrictEqual( results?.ranking.map( entry => entry.rank ), [ 1, 1 ] );
		} );

		it( "names no winner when nobody solved anything", () => {
			// Everyone floors at zero, so nobody strictly outscores anybody.
			const game = at( {
				guesses: { [ alice ]: spend( 6 ), [ bob ]: spend( 6 ) }
			} );

			assert.isUndefined( game.results()?.winner );
		} );

		it( "carries each seat's score on its standing", () => {
			const game = at( { guesses: { [ alice ]: [ "crane" ] } } );
			const standing = game.results()?.ranking.find( entry => entry.playerId === alice );

			assert.strictEqual( standing?.score, scoreFor( game.state, config(), alice ) );
		} );
	} );

	describe( "resolveNextPlayer", () => {

		it( "rotates one guess at a time, so bots race rather than sprint", () => {
			assert.strictEqual( at().nextPlayer( alice, "guess" ), bob );
		} );

		it( "skips a seat with nothing left", () => {
			const game = at( { guesses: { [ bob ]: [ "crane" ] } } );
			assert.strictEqual( game.nextPlayer( alice, "guess" ), alice );
		} );
	} );

	describe( "the view", () => {

		const played = () => at( {
			words: [ "crane" ],
			guesses: { [ alice ]: [ "spout" ], [ bob ]: [ "abbey", "aback" ] }
		} );

		it( "gives a seat its own rows and a rival's tallies only", () => {
			// Every seat races the *same* words, so a rival column going all-correct
			// would name the guess that solved it.
			const view = played().view( PlayerAudience.make( { playerId: alice } ) );
			const [ mine, theirs ] = view.boards;

			assert.deepStrictEqual( [ ...mine!.guesses ], [ "spout" ] );
			assert.isAbove( mine!.results.length, 0 );

			assert.deepStrictEqual( [ ...theirs!.guesses ], [] );
			assert.deepStrictEqual( [ ...theirs!.results ], [] );
			assert.strictEqual( theirs!.guessCount, 2, "the size still shows" );
		} );

		it( "lets a spectator read every board", () => {
			// A watcher holds no words of their own, so there is nothing for a
			// rival's rows to give them an advantage in.
			const view = played().view( TableAudience.make( {} ) );

			assert.deepStrictEqual( [ ...view.boards[ 0 ]!.guesses ], [ "spout" ] );
			assert.deepStrictEqual( [ ...view.boards[ 1 ]!.guesses ], [ "abbey", "aback" ] );
		} );

		it( "keeps the answers sealed until the game is decided", () => {
			assert.isUndefined( played().view( TableAudience.make( {} ) ).answers );
		} );

		it( "reveals the answers once it is, to everybody", () => {
			const game = at( { decided: true } );

			assert.deepStrictEqual(
				[ ...game.view( TableAudience.make( {} ) ).answers! ],
				[ "crane" ]
			);
			assert.deepStrictEqual(
				[ ...game.view( PlayerAudience.make( { playerId: alice } ) ).answers! ],
				[ "crane" ]
			);
		} );

		it( "opens every board once the game is decided", () => {
			const game = at( {
				decided: true,
				guesses: { [ alice ]: [ "spout" ], [ bob ]: [ "abbey" ] }
			} );

			const view = game.view( PlayerAudience.make( { playerId: alice } ) );
			assert.deepStrictEqual( [ ...view.boards[ 1 ]!.guesses ], [ "abbey" ] );
		} );

		it( "publishes one board per seat, in join order", () => {
			const view = played().view( TableAudience.make( {} ) );
			assert.deepStrictEqual( view.boards.map( board => board.playerId ), [ alice, bob ] );
		} );

		it( "publishes the allowance so a client can lay the grid out", () => {
			const view = at( {}, { wordCount: 3, wordLength: 6 } ).view( TableAudience.make( {} ) );
			assert.strictEqual(
				view.maxGuesses,
				maxGuessesFor( config( { wordCount: 3, wordLength: 6 } ) )
			);
		} );

		it( "tells a seat which board is its own", () => {
			assert.strictEqual(
				played().view( PlayerAudience.make( { playerId: bob } ) ).playerId,
				bob
			);
			assert.isUndefined( played().view( TableAudience.make( {} ) ).playerId );
		} );

		it( "marks a finished board finished, whichever way it finished", () => {
			const game = at( { guesses: { [ alice ]: [ "crane" ] }, forfeited: [ bob ] } );
			const view = game.view( TableAudience.make( {} ) );

			assert.isTrue( view.boards[ 0 ]!.finished );
			assert.isTrue( view.boards[ 1 ]!.finished );
		} );
	} );
} );
