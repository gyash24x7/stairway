import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { wordle } from "@/games/wordle/server/engine.ts";
import { dictionaries } from "@/games/wordle/shared/dictionary.ts";
import { isValidWord } from "@/games/wordle/shared/utils.ts";
import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import {
	createInput,
	publishedViews,
	runGame,
	tagsIn,
	testClock
} from "@tests/helpers/runner.ts";

import type { WordleConfig, WordleState, WordleView } from "@/games/wordle/shared/schema.ts";

/** How soon the engine plays a machine seat once it is the one being waited on. */
const BOT_DELAY_MS = 5_000;

const player = ( id: string ) => PlayerId.make( id );

const [ a, b ] = [ player( "a" ), player( "b" ) ];

const info = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const configOf = ( over: Partial<WordleConfig> = {} ): WordleConfig => ( {
	playerCount: 1,
	autoStart: false,
	wordCount: 1,
	wordLength: 5,
	...over
} );

/**
 * Seats a table, starts it, and hands the body the words it is hiding — read
 * straight out of the store, since a seat is never told them until the game is
 * decided and a test has to know what it is chasing.
 *
 * @param body - What to play, given the engine and the hidden words.
 * @param [config] - What the table is created with.
 * @param [players] - Who takes the seats.
 * @returns The run's result and collectors.
 */
const table = <A, E>(
	body: (
		engine: Effect.Success<typeof wordle>,
		words: ReadonlyArray<string>
	) => Effect.Effect<A, E>,
	config: Partial<WordleConfig> = {},
	players: ReadonlyArray<Player> = [ a ]
) => {
	const cells = new Map<string, unknown>();

	return runGame( wordle, engine => Effect.gen( function* () {
		yield* engine.initialize( createInput( configOf( {
			...config,
			playerCount: players.length
		} ) ) );
		yield* Effect.forEach( players, id => engine.join( info( id ) ) );
		yield* engine.start( players[ 0 ]! );

		const record = cells.get( "data" ) as { readonly state: WordleState };
		return yield* body( engine, record.state.words );
	} ), { cells } );
};

/** A dictionary word of the right length that is not one of the answers. */
const decoy = ( words: ReadonlyArray<string>, length: 4 | 5 | 6 = 5 ) =>
	dictionaries[ length ].find( word => !words.includes( word ) )!;


describe( "setting up a board", () => {
	test( "hides as many distinct words as the table asked for", () => {
		const { result } = table(
			( _engine, words ) => Effect.succeed( words ),
			{ wordCount: 3 }
		);

		expect( result ).toHaveLength( 3 );
		expect( new Set( result ).size ).toBe( 3 );
	} );

	test( "draws them at the length the table plays at", () => {
		const { result } = table(
			( _engine, words ) => Effect.succeed( words ),
			{ wordLength: 6, wordCount: 2 }
		);

		expect( result.every( word => word.length === 6 ) ).toBe( true );
		expect( result.every( word => dictionaries[ 6 ].includes( word ) ) ).toBe( true );
	} );

	test( "keeps them secret while the game is on", () => {
		const { result } = table( engine => engine.getState( a ) );

		expect( result.view.answers ).toBeUndefined();
		expect( result.view.decided ).toBe( false );
	} );

	test( "opens one board per seat, in join order", () => {
		const { result } = table( engine => engine.getState(), {}, [ a, b ] );

		expect( result.view.boards.map( board => board.playerId ) ).toEqual( [ a, b ] );
		expect( result.view.maxGuesses ).toBe( 6 );
	} );
} );


describe( "playing a guess", () => {
	test( "records it and scores the board", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: decoy( words ) }, a );
			return yield* engine.getState( a );
		} ) );

		const own = result.view.boards[ 0 ]!;

		expect( own.guessCount ).toBe( 1 );
		expect( own.results[ 0 ] ).toHaveLength( 1 );
	} );

	test( "does not cost the seat its turn", () => {
		// Every seat races the same words on its own board, so nobody waits. The
		// cursor moves on to schedule whoever is next — with nobody else still
		// playing, that is this seat again.
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: decoy( words ) }, a );
			yield* engine.guess( { guess: words[ 0 ]! }, a );
			return yield* engine.getState( a );
		} ) );

		expect( result.view.boards[ 0 ]?.guessCount ).toBe( 2 );
		expect( result.context.currentPlayer ).toBe( a );
	} );

	test( "hands the cursor to the next seat still playing", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.forfeit( {}, b );
			yield* engine.guess( { guess: decoy( words ) }, a );
			return yield* engine.getState( a );
		} ), {}, [ a, b ] );

		// `b` is done, so waiting on it would be waiting on a seat with no move.
		expect( result.context.currentPlayer ).toBe( a );
	} );

	test( "any seat may guess, whoever the turn sits with", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: decoy( words ) }, b );
			return yield* engine.getState( b );
		} ), {}, [ a, b ] );

		expect( result.context.currentPlayer ).toBe( a );
		expect( result.view.boards[ 1 ]?.guessCount ).toBe( 1 );
	} );

	test( "accepts a guess typed in caps or padded with space", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: `  ${ words[ 0 ]!.toUpperCase() } ` }, a );
			return yield* engine.getState( a );
		} ) );

		expect( result.view.boards[ 0 ]?.solvedWords ).toEqual( [ true ] );
	} );

	test( "refuses a guess of the wrong length", () => {
		const { result } = table(
			engine => engine.guess( { guess: "crate" }, a ).pipe( Effect.flip ),
			{ wordLength: 6 }
		);

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as { reason: string } ).reason ).toContain( "6 letters long" );
	} );

	test( "refuses a word the dictionary does not hold", () => {
		const { result } = table( engine => engine.guess( { guess: "zzzzz" }, a ).pipe( Effect.flip ) );

		expect( ( result as { reason: string } ).reason ).toBe( "The guess is not a valid word" );
	} );

	test( "refuses a seat that has already finished", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: words[ 0 ]! }, a );
			return yield* engine.guess( { guess: decoy( words ) }, a ).pipe( Effect.flip );
		} ), {}, [ a, b ] );

		expect( ( result as { reason: string } ).reason ).toBe( "You have finished your board" );
	} );

	test( "refuses a guess from someone who holds no seat", () => {
		const { result } = table( ( engine, words ) =>
			engine.guess( { guess: decoy( words ) }, b ).pipe( Effect.flip )
		);

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );
} );


describe( "a seat that runs out its clock", () => {
	const MOVE_TIMEOUT = 30_000;

	/**
	 * The point of the clock in this game. A wordle only ends once every board is
	 * finished, so a seat that walks away holds the whole table forever — and the
	 * other player has no way out, since `forfeit` retires only the caller and
	 * autoplay switches only the caller's own seat.
	 */
	const stalled = <A, E>(
		body: ( engine: Effect.Success<typeof wordle> ) => Effect.Effect<A, E>
	) => {
		const clock = testClock();

		return runGame( wordle, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( configOf( {
				playerCount: 2,
				moveTimeoutMillis: MOVE_TIMEOUT
			} ) ) );
			yield* Effect.forEach( [ a, b ], id => engine.join( info( id ) ) );
			yield* engine.start( a );

			clock.advance( MOVE_TIMEOUT + 1 );
			yield* engine.alarm();

			return yield* body( engine );
		} ), { now: clock.now } );
	};

	test( "gives up rather than having a word guessed for it", () => {
		const { result } = stalled( engine => engine.getState() );

		const walked = result.view.boards.find( board => board.playerId === a )!;

		expect( walked.finished ).toBe( true );
		// Nothing was played on their behalf — giving up is not the same as being
		// guessed for, and the difference is whose game it was.
		expect( walked.guesses ).toEqual( [] );
	} );

	test( "keeps the seat its player's rather than handing it to the policy", () => {
		const { result } = stalled( engine => engine.getState() );

		expect( result.autoPlay[ a ] ).toBeUndefined();
	} );

	test( "lets the table finish, which is the whole point of the clock", () => {
		const { result } = stalled( engine => Effect.gen( function* () {
			// The seat that stayed can now end the game on its own. Before the clock
			// existed this table could never reach `COMPLETED` at all.
			yield* engine.forfeit( {}, b );
			return yield* engine.getState();
		} ) );

		expect( result.status ).toBe( "COMPLETED" );
	} );
} );

describe( "giving up", () => {
	test( "retires the seat", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.forfeit( {}, b );
			return yield* engine.getState( b );
		} ), {}, [ a, b ] );

		expect( result.view.boards[ 1 ]?.finished ).toBe( true );
	} );

	test( "charges the whole allowance rather than banking the rest", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: words[ 0 ]! }, a );
			yield* engine.guess( { guess: decoy( words ) }, b );
			yield* engine.forfeit( {}, b );
			return yield* engine.getState();
		} ), { wordCount: 2 }, [ a, b ] );

		const gaveUp = result.view.boards[ 1 ]!;

		expect( gaveUp.guessCount ).toBe( 1 );
		expect( gaveUp.score ).toBe( 0 );
	} );

	test( "refuses a seat that is already done", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.forfeit( {}, b );
			return yield* engine.forfeit( {}, b ).pipe( Effect.flip );
		} ), {}, [ a, b ] );

		expect( ( result as { reason: string } ).reason ).toBe( "You have finished your board" );
	} );
} );


describe( "what one seat may read of another", () => {
	const raced = <A, E>(
		body: (
			engine: Effect.Success<typeof wordle>,
			words: ReadonlyArray<string>
		) => Effect.Effect<A, E>
	) => table( ( engine, words ) => Effect.gen( function* () {
		yield* engine.guess( { guess: decoy( words ) }, a );
		yield* engine.guess( { guess: decoy( words ) }, b );
		return yield* body( engine, words );
	} ), { wordCount: 2 }, [ a, b ] );

	test( "its own rows, in full", () => {
		const { result } = raced( engine => engine.getState( a ) );

		expect( result.view.boards[ 0 ]?.guesses ).toHaveLength( 1 );
		expect( result.view.boards[ 0 ]?.results[ 0 ] ).toHaveLength( 1 );
	} );

	test( "a rival's tallies, and none of its rows", () => {
		const { result } = raced( engine => engine.getState( a ) );
		const rival = result.view.boards[ 1 ]!;

		expect( rival.guesses ).toEqual( [] );
		expect( rival.results ).toEqual( [] );
		expect( rival.guessCount ).toBe( 1 );
	} );

	test( "the table reads nobody's rows", () => {
		const { result } = raced( engine => engine.getState() );

		expect( result.view.boards.every( board => board.guesses.length === 0 ) ).toBe( true );
		expect( result.view.playerId ).toBeUndefined();
	} );
} );


describe( "how a game ends", () => {
	test( "a solitaire board ends when its seat solves every word", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			for ( const word of words ) {
				yield* engine.guess( { guess: word }, a );
			}
			return yield* engine.getState( a );
		} ), { wordCount: 2 } );

		expect( result.status ).toBe( "COMPLETED" );
		expect( result.view.decided ).toBe( true );
	} );

	test( "and reveals the answers, in the order the boards are laid out", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			for ( const word of words ) {
				yield* engine.guess( { guess: word }, a );
			}
			return { words, view: yield* engine.getState( a ) };
		} ), { wordCount: 2 } );

		expect( result.view.view.answers ).toEqual( result.words );
	} );

	test( "a duel waits for every seat to be done", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: words[ 0 ]! }, a );
			const halfway = yield* engine.getState();
			yield* engine.forfeit( {}, b );
			return { halfway, done: yield* engine.getState() };
		} ), {}, [ a, b ] );

		expect( result.halfway.status ).toBe( "IN_PROGRESS" );
		expect( result.done.status ).toBe( "COMPLETED" );
	} );

	test( "a seat that runs its allowance out is done without solving", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			const wrong = dictionaries[ 5 ].filter( word => !words.includes( word ) ).slice( 0, 6 );
			for ( const word of wrong ) {
				yield* engine.guess( { guess: word }, a );
			}
			return yield* engine.getState( a );
		} ) );

		expect( result.status ).toBe( "COMPLETED" );
		expect( result.view.boards[ 0 ]?.solvedWords ).toEqual( [ false ] );
		expect( result.view.boards[ 0 ]?.score ).toBe( 0 );
	} );

	test( "the winner is the seat strictly ahead", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: words[ 0 ]! }, a );
			yield* engine.forfeit( {}, b );
			return yield* engine.getState();
		} ), {}, [ a, b ] );

		expect( result.results?.winner ).toBe( a );
		expect( result.results?.ranking[ 0 ] ).toMatchObject( { playerId: a, rank: 1 } );
	} );

	test( "a solo seat that leaves a word unsolved is not a winner", () => {
		// A solitaire is won by solving it, not by outscoring an empty field. Solving
		// one of two words still scores, so without this the lone seat was crowned
		// for a puzzle it never finished.
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: words[ 0 ]! }, a );
			yield* engine.forfeit( {}, a );
			return yield* engine.getState();
		} ), { wordCount: 2 } );

		expect( result.status ).toBe( "COMPLETED" );
		expect( result.results?.ranking[ 0 ]?.score ).toBeGreaterThan( 0 );
		expect( result.results?.winner ).toBeUndefined();
	} );

	test( "a solo seat that solves every word does win", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			for ( const word of words ) {
				yield* engine.guess( { guess: word }, a );
			}
			return yield* engine.getState();
		} ), { wordCount: 2 } );

		expect( result.status ).toBe( "COMPLETED" );
		expect( result.results?.winner ).toBe( a );
	} );

	test( "two seats level on score leave the game with no winner", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.forfeit( {}, a );
			yield* engine.forfeit( {}, b );
			return yield* engine.getState();
		} ), {}, [ a, b ] );

		expect( result.results?.winner ).toBeUndefined();
		expect( result.results?.ranking.every( standing => standing.rank === 1 ) ).toBe( true );
	} );

	test( "nobody solving anything leaves no winner either", () => {
		// Refusing to guess must never win: a seat that solved nothing scores zero,
		// whatever it spent.
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.forfeit( {}, a );
			yield* engine.forfeit( {}, b );
			return yield* engine.getState();
		} ), {}, [ a, b ] );

		expect( result.results?.ranking.every( standing => standing.score === 0 ) ).toBe( true );
	} );

	test( "a finished game refuses further guesses", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: words[ 0 ]! }, a );
			return yield* engine.guess( { guess: decoy( words ) }, a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/GameNotInProgress" );
	} );

	test( "the finished game is archived with every seat's final board", () => {
		const { saved } = table( ( engine, words ) => engine.guess( { guess: words[ 0 ]! }, a ) );
		const archived = saved.get( "wordle:game-1" ) as
			undefined | { readonly playerViews: Record<Player, { readonly answers?: unknown }> };

		expect( [ ...saved.keys() ] ).toEqual( [ "wordle:game-1" ] );
		// The words are out by then, so the archived views carry them.
		expect( archived?.playerViews[ a ]?.answers ).toBeDefined();
	} );
} );


describe( "taking a guess back", () => {
	test( "a seat may undo its own guess", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: decoy( words ) }, a );
			yield* engine.undo( a );
			return yield* engine.getState( a );
		} ) );

		expect( result.view.boards[ 0 ]?.guessCount ).toBe( 0 );
	} );

	test( "but not a rival's", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: decoy( words ) }, b );
			return yield* engine.undo( a ).pipe( Effect.flip );
		} ), {}, [ a, b ] );

		expect( result._tag ).toBe( "swish/UndoNotAllowed" );
	} );

	test( "and the same words come back on a redo", () => {
		const { result } = table( ( engine, words ) => Effect.gen( function* () {
			yield* engine.guess( { guess: decoy( words ) }, a );
			const played = yield* engine.getState( a );
			yield* engine.undo( a );
			yield* engine.redo( a );
			return { played, replayed: yield* engine.getState( a ) };
		} ) );

		expect( result.replayed.view ).toEqual( result.played.view );
	} );
} );


/**
 * The same table, seated by machines and run against a clock the body moves by
 * hand. Nothing fires on its own: `playOut` advances past the bot's delay and
 * then calls `alarm()`, which is what makes a bot's turn a step in a sequence
 * rather than a wait.
 *
 * @param body - What to play, given the engine, the hidden words and the clock.
 * @param [config] - What the table is created with.
 * @param [players] - Who takes the seats.
 * @param [bots] - Whether those seats are machines. Humans get handed over with
 * 			`setAutoPlay` instead.
 * @returns The run's result and collectors.
 */
const machineTable = <A, E>(
	body: (
		engine: Effect.Success<typeof wordle>,
		clock: ReturnType<typeof testClock>,
		words: ReadonlyArray<string>
	) => Effect.Effect<A, E>,
	config: Partial<WordleConfig> = {},
	players: ReadonlyArray<Player> = [ a ],
	bots = true
) => {
	const cells = new Map<string, unknown>();
	const clock = testClock();

	return runGame( wordle, engine => Effect.gen( function* () {
		yield* engine.initialize( createInput( configOf( {
			...config,
			playerCount: players.length
		} ) ) );

		yield* Effect.forEach( players, id => engine.join(
			PlayerInfo.make( { ...info( id ), isBot: bots } )
		) );

		yield* engine.start( players[ 0 ]! );

		const record = cells.get( "data" ) as { readonly state: WordleState };
		return yield* body( engine, clock, record.state.words );
	} ), { cells, now: clock.now } );
};

/**
 * Wakes the table until nobody is left to play, or the ceiling is hit. The
 * ceiling only ever catches a bot that has stopped moving: a table of `n` seats
 * spends at most `n · maxGuesses` guesses, and one wake-up plays one of them.
 *
 * @param engine - The engine to drive.
 * @param clock - The clock to move past each armed delay.
 * @param [limit] - The most wake-ups to spend.
 * @returns The table's view once it stops.
 */
const playOut = (
	engine: Effect.Success<typeof wordle>,
	clock: ReturnType<typeof testClock>,
	limit = 100
) =>
	Effect.gen( function* () {
		for ( let i = 0; i < limit; i++ ) {
			const view = yield* engine.getState();
			if ( view.status === "COMPLETED" ) {
				break;
			}

			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();
		}

		return yield* engine.getState();
	} );


describe( "the bot", () => {
	test( "plays the seat a player hands it", () => {
		const { result } = machineTable( ( engine, clock ) => Effect.gen( function* () {
			yield* engine.setAutoPlay( a, true );
			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();
			return yield* engine.getState( a );
		} ), {}, [ a ], false );

		expect( result.autoPlay[ a ] ).toBe( true );
		expect( result.view.boards[ 0 ]?.guessCount ).toBe( 1 );
	} );

	test( "guesses only words the table would accept", () => {
		const { result } = machineTable(
			( engine, clock ) => playOut( engine, clock ),
			{ wordCount: 3, wordLength: 6 }
		);

		const guesses = result.view.boards[ 0 ]!.guesses;

		expect( guesses.length ).toBeGreaterThan( 0 );
		expect( guesses.every( guess => isValidWord( guess, 6 ) ) ).toBe( true );
	} );

	test( "never guesses the same word twice", () => {
		const { result } = machineTable( ( engine, clock ) => playOut( engine, clock ), { wordCount: 4 } );
		const guesses = result.view.boards[ 0 ]!.guesses;

		expect( new Set( guesses ).size ).toBe( guesses.length );
	} );

	test( "solves the board it is given", () => {
		const { result } = machineTable( ( engine, clock ) => playOut( engine, clock ) );

		expect( result.view.boards[ 0 ]?.solvedWords ).toEqual( [ true ] );
		expect( result.status ).toBe( "COMPLETED" );
	} );

	test( "never gives up, whatever the board costs it", () => {
		// Forfeiting charges the whole remaining allowance rather than banking it,
		// so playing on is never worse — and might still solve a word.
		const { result, cells } = machineTable(
			( engine, clock ) => playOut( engine, clock ),
			{ wordCount: 5 }
		);

		expect( tagsIn( cells ) ).not.toContain( "wordle/ev/Forfeited" );
		expect( result.status ).toBe( "COMPLETED" );
	} );

	test( "plays every machine seat at the table, not just the one holding the cursor", () => {
		const { result } = machineTable(
			( engine, clock ) => playOut( engine, clock ),
			{ wordCount: 2 },
			[ a, b ]
		);

		expect( result.status ).toBe( "COMPLETED" );
		expect( result.view.boards.map( board => board.guessCount > 0 ) ).toEqual( [ true, true ] );
	} );

	test( "keeps racing once the seat beside it has given up", () => {
		const { result } = machineTable( ( engine, clock ) => Effect.gen( function* () {
			yield* engine.forfeit( {}, a );
			return yield* playOut( engine, clock );
		} ), { wordCount: 2 }, [ a, b ] );

		// `a` is done, so the cursor belongs to `b` alone from here — a table that
		// waited on the retired seat would never wake up again.
		expect( result.status ).toBe( "COMPLETED" );
		expect( result.view.boards[ 1 ]?.guessCount ).toBeGreaterThan( 0 );
	} );

	test( "learns nothing from a rival's board", () => {
		// Every seat races the same words, so a rival's rows would be free scored
		// probes. The policy reads the view the engine hands it, and that view has
		// the rival redacted — this is the assertion that keeps it that way.
		const { published } = machineTable(
			( engine, clock ) => playOut( engine, clock ),
			{ wordCount: 2 },
			[ a, b ]
		);

		const views = publishedViews<WordleView, WordleConfig>( published );
		const mid = views[ Math.floor( views.length / 2 ) ]!;

		expect( mid.players[ a ]!.view.boards.find( board => board.playerId === b )?.results )
			.toEqual( [] );
	} );
} );
