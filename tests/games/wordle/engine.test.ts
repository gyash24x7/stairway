import { beforeEach, describe, expect, test } from "bun:test";

import { dictionaries } from "@/games/wordle/server/dictionary.ts";
import { wordle } from "@/games/wordle/server/engine.ts";
import type { WordleConfig, WordleState, WordLength } from "@/games/wordle/shared/schema.ts";
import { GameCode, GameId, type PlayerId } from "@/shared/swish/schema.ts";
import { makeMemory, type Memory, player, run, runFail } from "@tests/_helpers/swish.ts";

const GID = GameId.make( "g1" );
const CODE = GameCode.make( "WRD123" );

const P1 = player( "p1" );
/** Never joins — proves every command is gated on membership. */
const STRANGER = player( "p9" );

/** The shape the wordle client actually creates: one seat, one 5-letter word. */
const WORDLE_CONFIG: WordleConfig = {
	playerCount: 1,
	autoStart: false,
	wordCount: 1,
	wordLength: 5
};

/**
 * The record the fake `GameStore` holds. It is the ONLY place the answer words
 * exist — the view deliberately never carries them — so the tests read their
 * targets from here rather than from anything a client can see.
 */
const persisted = ( memory: Memory ) => memory.store.value as {
	status: string;
	config: WordleConfig;
	state: WordleState;
	context: { turn: number; currentPlayer: PlayerId };
};

/** The answer words the engine drew for this game. */
const answers = ( memory: Memory ) => persisted( memory ).state.words;

/** `count` dictionary words of the configured length that are NOT answers. */
const wrongGuesses = ( memory: Memory, count: number ) => {
	const { state, config } = persisted( memory );
	return dictionaries[ config.wordLength ]
		.filter( ( word ) => !state.words.includes( word ) )
		.slice( 0, count );
};

/** The table + per-player payload of the most recent broadcast. */
const lastBroadcast = ( memory: Memory ) => memory.broadcasts.at( -1 )! as {
	channel: string;
	snapshot: { table: { view: unknown }; playerViews: Record<string, unknown> };
};

/** Overwrite fields of the stored snapshot's game state, simulating drift. */
const patchStoredState = ( memory: Memory, patch: Record<string, unknown> ) => {
	const snap = memory.store.value as { state: Record<string, unknown> };
	memory.store.value = { ...snap, state: { ...snap.state, ...patch } };
};

/** initialize → join p1 → (optionally) start. Wordle seats exactly one player. */
async function bootWordle(
	memory: Memory,
	opts: { config?: Partial<WordleConfig>; start?: boolean; seed?: string } = {}
) {
	const engine = await run( memory, wordle );
	const config = { ...WORDLE_CONFIG, ...opts.config };

	await run( memory, engine.initialize( {
		id: GID, code: CODE, config, seed: opts.seed ?? "seed"
	} ) );
	await run( memory, engine.join( P1 ) );

	if ( opts.start !== false ) {
		await run( memory, engine.start( P1.id ) );
	}

	return engine;
}

// ===========================================================================
describe( "wordle — setup & config", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "initialize draws the answers and sizes the board from the config", async () => {
		await bootWordle( memory, { start: false } );
		const { state, status } = persisted( memory );

		expect( status ).toBe( "PLAYERS_READY" );
		expect( state.words ).toHaveLength( 1 );
		expect( state.guesses ).toEqual( [] );
		// One guess budget per word plus one per letter.
		expect( state.maxGuesses ).toBe( 6 );
		// Every answer starts with an empty result list keyed by the word itself.
		expect( state.guessResults ).toEqual( { [ state.words[ 0 ]! ]: [] } );
	} );

	test.each( [ 4, 5, 6 ] as WordLength[] )(
		"a %i-letter game draws answers of that length from that dictionary",
		async ( wordLength ) => {
			await bootWordle( memory, { config: { wordLength }, start: false } );
			const { state } = persisted( memory );

			expect( state.words[ 0 ] ).toHaveLength( wordLength );
			expect( dictionaries[ wordLength ] ).toContain( state.words[ 0 ]! );
			expect( state.maxGuesses ).toBe( 1 + wordLength );
		}
	);

	test.each( [ 1, 2, 4 ] )( "a %i-word game draws that many distinct answers", async ( wordCount ) => {
		await bootWordle( memory, { config: { wordCount }, start: false } );
		const { state } = persisted( memory );

		expect( state.words ).toHaveLength( wordCount );
		// `setup` fills a Set, so a game never hands out the same answer twice.
		expect( new Set( state.words ).size ).toBe( wordCount );
		expect( state.maxGuesses ).toBe( wordCount + 5 );
		expect( Object.keys( state.guessResults ).sort() ).toEqual( [ ...state.words ].sort() );
	} );

	test( "the real client flow — one seat, autoStart — starts off the alarm", async () => {
		const engine = await bootWordle( memory, { config: { autoStart: true }, start: false } );
		expect( memory.scheduler.scheduled.map( ( s ) => s.alarm ) ).toContain( "auto-start" );

		await run( memory, engine.alarm() );
		expect( ( await run( memory, engine.getState( P1.id ) ) ).status ).toBe( "IN_PROGRESS" );
	} );

	test( "start puts the single-seat game IN_PROGRESS with p1 to act", async () => {
		const engine = await bootWordle( memory );
		const state = await run( memory, engine.getState( P1.id ) );

		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.context.currentPlayer ).toBe( P1.id );
		expect( state.view.maxGuesses ).toBe( 6 );
		expect( state.view.guesses ).toEqual( [] );
	} );
} );

// ===========================================================================
describe( "wordle — guess validation", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a guess that is not a dictionary word is rejected", async () => {
		const engine = await bootWordle( memory );
		const error = await runFail( memory, engine.guess( { guess: "zzzzz" }, P1 ) );

		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error ).toMatchObject( { move: "guess", reason: "The guess is not a valid word" } );
	} );

	test.each( [ "cat", "crab", "cranes" ] )(
		"a guess of the wrong length (%s) is rejected",
		async ( guess ) => {
			// There is no explicit length rule: a mis-sized guess simply cannot be in
			// the length-keyed dictionary, so the same check catches it.
			const engine = await bootWordle( memory );
			const error = await runFail( memory, engine.guess( { guess }, P1 ) );
			expect( error._tag ).toBe( "swish/InvalidMove" );
		}
	);

	test( "an uppercase spelling of a real word is rejected — the dictionary is lowercase", async () => {
		const engine = await bootWordle( memory );
		const guess = wrongGuesses( memory, 1 )[ 0 ]!.toUpperCase();

		const error = await runFail( memory, engine.guess( { guess }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a rejected guess costs nothing — no commit, no guess spent", async () => {
		const engine = await bootWordle( memory );
		const commits = memory.log.commits.length;

		await runFail( memory, engine.guess( { guess: "zzzzz" }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( memory.log.commits ).toHaveLength( commits );
		expect( state.view.guesses ).toEqual( [] );
		expect( state.context.turn ).toBe( 0 );
	} );

	test( "the out-of-guesses guard rejects a guess when the budget is spent", async () => {
		// Unreachable in normal play — `endIf` completes the game on the last guess,
		// so a real player hits `GameNotInProgress` first (asserted below). Drive it
		// by handing the engine a snapshot whose budget is already exhausted.
		const engine = await bootWordle( memory );
		patchStoredState( memory, { guesses: wrongGuesses( memory, 6 ) } );

		const error = await runFail( memory, engine.guess( { guess: "crane" }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error ).toMatchObject( { move: "guess", reason: "No more guesses left" } );
	} );

	test( "a repeat of an earlier guess is accepted and spends another guess", async () => {
		// Wordle declares no duplicate-guess rule, so the board simply records the
		// same row twice.
		const engine = await bootWordle( memory );
		const [ guess ] = wrongGuesses( memory, 1 );

		await run( memory, engine.guess( { guess: guess! }, P1 ) );
		await run( memory, engine.guess( { guess: guess! }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.guesses ).toEqual( [ guess!, guess! ] );
		expect( state.status ).toBe( "IN_PROGRESS" );
	} );

	test( "a non-member can neither read the board nor guess", async () => {
		const engine = await bootWordle( memory );

		expect( ( await runFail( memory, engine.getState( STRANGER.id ) ) )._tag )
			.toBe( "swish/NotAMember" );
		expect( ( await runFail( memory, engine.guess( { guess: "crane" }, STRANGER ) ) )._tag )
			.toBe( "swish/NotAMember" );
	} );

	test( "a guess before the game starts fails with GameNotInProgress", async () => {
		const engine = await bootWordle( memory, { start: false } );
		const error = await runFail( memory, engine.guess( { guess: "crane" }, P1 ) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );
} );

// ===========================================================================
describe( "wordle — guessing & the board", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a wrong guess records one scored row and advances the turn", async () => {
		const engine = await bootWordle( memory );
		const [ guess ] = wrongGuesses( memory, 1 );
		await run( memory, engine.guess( { guess: guess! }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.guesses ).toEqual( [ guess! ] );
		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.context.turn ).toBe( 1 );
		// One seat and no `resolveNextPlayer`, so the guesser keeps the board.
		expect( state.context.currentPlayer ).toBe( P1.id );

		const row = state.view.guessResults[ 0 ]![ 0 ]!;
		expect( row.map( ( r ) => r.letter ).join( "" ) ).toBe( guess! );
		// Some letters may land, but a non-answer can never score every position.
		expect( row.every( ( r ) => r.status === "correct" ) ).toBe( false );
	} );

	test( "unplayed rows are padded to maxGuesses with blank absent cells", async () => {
		const engine = await bootWordle( memory );
		await run( memory, engine.guess( { guess: wrongGuesses( memory, 1 )[ 0 ]! }, P1 ) );

		const board = ( await run( memory, engine.getState( P1.id ) ) ).view.guessResults[ 0 ]!;
		expect( board ).toHaveLength( 6 );
		expect( board.slice( 1 ) ).toEqual( Array.from(
			{ length: 5 },
			() => Array.from( { length: 5 }, () => ( { letter: "", status: "absent" as const } ) )
		) );
	} );

	test( "guessing an answer scores that word all-correct", async () => {
		const engine = await bootWordle( memory );
		const answer = answers( memory )[ 0 ]!;
		await run( memory, engine.guess( { guess: answer }, P1 ) );

		const row = ( await run( memory, engine.getState( P1.id ) ) ).view.guessResults[ 0 ]![ 0 ]!;
		expect( row.every( ( r ) => r.status === "correct" ) ).toBe( true );
		expect( row.map( ( r ) => r.letter ).join( "" ) ).toBe( answer );
	} );

	test( "one guess is scored against every answer of a multi-word game", async () => {
		const engine = await bootWordle( memory, { config: { wordCount: 3 } } );
		const [ first ] = answers( memory );
		await run( memory, engine.guess( { guess: first! }, P1 ) );

		const board = ( await run( memory, engine.getState( P1.id ) ) ).view.guessResults;
		expect( board ).toHaveLength( 3 );
		// The guessed word is solved; the other two got their own scoring of it.
		expect( board[ 0 ]![ 0 ]!.every( ( r ) => r.status === "correct" ) ).toBe( true );
		for ( const word of board.slice( 1 ) ) {
			expect( word[ 0 ]!.map( ( r ) => r.letter ).join( "" ) ).toBe( first! );
		}
	} );

	test( "a solved word's rows stop at the solving guess and pad from there", async () => {
		const engine = await bootWordle( memory, { config: { wordCount: 2 } } );
		const [ first ] = answers( memory );
		await run( memory, engine.guess( { guess: first! }, P1 ) );
		await run( memory, engine.guess( { guess: wrongGuesses( memory, 1 )[ 0 ]! }, P1 ) );

		const board = ( await run( memory, engine.getState( P1.id ) ) ).view.guessResults;
		// maxGuesses = 2 words + 5 letters. The solved word keeps only its winning
		// row; the unsolved one shows both guesses.
		expect( board[ 0 ] ).toHaveLength( 7 );
		expect( board[ 0 ]![ 1 ]!.every( ( r ) => r.letter === "" ) ).toBe( true );
		expect( board[ 1 ]![ 1 ]!.map( ( r ) => r.letter ).join( "" ) ).not.toBe( "" );
	} );
} );

// ===========================================================================
describe( "wordle — view redaction (the answers must not leak)", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "the player view carries no answer word while the game runs", async () => {
		const engine = await bootWordle( memory, { config: { wordCount: 3 } } );
		const words = answers( memory );

		const state = await run( memory, engine.getState( P1.id ) );
		// The record the server holds does contain them — so this check has teeth.
		expect( JSON.stringify( persisted( memory ).state ) ).toContain( words[ 0 ]! );
		for ( const word of words ) {
			expect( JSON.stringify( state.view ) ).not.toContain( word );
		}

		expect( state.view ).not.toHaveProperty( "words" );
		// The whole public surface: the board, the budget, and who is looking.
		expect( Object.keys( state.view ).sort() ).toEqual(
			[ "_tag", "guessResults", "guesses", "maxGuesses", "playerId", "victory" ]
		);
	} );

	test( "a lost game still withholds the answers", async () => {
		const engine = await bootWordle( memory );
		const [ answer ] = answers( memory );
		for ( const guess of wrongGuesses( memory, 6 ) ) {
			await run( memory, engine.guess( { guess }, P1 ) );
		}

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.victory ).toBe( false );
		// Losing reveals nothing: the word the player failed to find stays server-side.
		expect( JSON.stringify( state.view ) ).not.toContain( answer! );
	} );

	test( "the broadcast table view is a spectator projection with no answers", async () => {
		const engine = await bootWordle( memory );
		const [ answer ] = answers( memory );
		await run( memory, engine.guess( { guess: wrongGuesses( memory, 1 )[ 0 ]! }, P1 ) );

		const last = lastBroadcast( memory );
		expect( last.channel ).toBe( "wordle:g1" );
		expect( JSON.stringify( last.snapshot.table.view ) ).not.toContain( answer! );
		// The table audience gets the public board only; the player gets their own.
		expect( last.snapshot.table.view ).toMatchObject( { _tag: "wordle/TableView" } );
		expect( last.snapshot.table.view ).not.toHaveProperty( "playerId" );
		expect( Object.keys( last.snapshot.playerViews ) ).toEqual( [ P1.id ] );
	} );

	test( "the player view is tagged and keyed to the caller", async () => {
		const engine = await bootWordle( memory );
		const view = ( await run( memory, engine.getState( P1.id ) ) ).view;

		expect( view._tag ).toBe( "wordle/PlayerView" );
		expect( view._tag === "wordle/PlayerView" && view.playerId ).toBe( P1.id );
	} );
} );

// ===========================================================================
describe( "wordle — completion", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "guessing the only word wins the game", async () => {
		const engine = await bootWordle( memory );
		await run( memory, engine.guess( { guess: answers( memory )[ 0 ]! }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.victory ).toBe( true );
	} );

	test( "the game runs on until every word of a multi-word game is found", async () => {
		const engine = await bootWordle( memory, { config: { wordCount: 3 } } );
		const words = answers( memory );

		await run( memory, engine.guess( { guess: words[ 0 ]! }, P1 ) );
		await run( memory, engine.guess( { guess: words[ 1 ]! }, P1 ) );
		expect( ( await run( memory, engine.getState( P1.id ) ) ).status ).toBe( "IN_PROGRESS" );

		await run( memory, engine.guess( { guess: words[ 2 ]! }, P1 ) );
		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.victory ).toBe( true );
	} );

	test( "spending every guess loses the game", async () => {
		const engine = await bootWordle( memory, { config: { wordLength: 4 } } );
		const wrong = wrongGuesses( memory, 5 );

		for ( const [ i, guess ] of wrong.entries() ) {
			await run( memory, engine.guess( { guess }, P1 ) );
			const mid = await run( memory, engine.getState( P1.id ) );
			// maxGuesses = 1 word + 4 letters: the game only ends on the last one.
			expect( mid.status ).toBe( i === 4 ? "COMPLETED" : "IN_PROGRESS" );
		}

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.victory ).toBe( false );
		expect( state.view.guesses ).toEqual( wrong );
	} );

	test( "a completed game accepts no further guesses", async () => {
		const engine = await bootWordle( memory );
		await run( memory, engine.guess( { guess: answers( memory )[ 0 ]! }, P1 ) );

		const error = await runFail( memory, engine.guess( { guess: "crane" }, P1 ) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );

	test( "wordle declares no describe, so the action feed stays empty", async () => {
		const engine = await bootWordle( memory );
		await run( memory, engine.guess( { guess: wrongGuesses( memory, 1 )[ 0 ]! }, P1 ) );

		expect( await run( memory, engine.getLog( P1.id ) ) ).toEqual( [] );
	} );
} );

// ===========================================================================
describe( "wordle — resolveResults", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a solved puzzle crowns the only seat and scores the guesses spent", async () => {
		const engine = await bootWordle( memory );
		await run( memory, engine.guess( { guess: answers( memory )[ 0 ]! }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.results ).toEqual( {
			winner: P1.id,
			ranking: [ { playerId: P1.id, rank: 1, score: 1 } ]
		} );
	} );

	test( "running out of guesses still ranks the seat, but crowns nobody", async () => {
		const engine = await bootWordle( memory, { config: { wordLength: 4 } } );
		for ( const guess of wrongGuesses( memory, 5 ) ) {
			await run( memory, engine.guess( { guess }, P1 ) );
		}

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.victory ).toBe( false );
		expect( state.results?.winner ).toBeUndefined();
		expect( state.results?.ranking ).toEqual( [ { playerId: P1.id, rank: 1, score: 5 } ] );
	} );

	test( "an unfinished puzzle has no results", async () => {
		const engine = await bootWordle( memory, { config: { wordCount: 3 } } );
		await run( memory, engine.guess( { guess: answers( memory )[ 0 ]! }, P1 ) );

		expect( ( await run( memory, engine.getState( P1.id ) ) ).results ).toBeUndefined();
	} );
} );

// ===========================================================================
describe( "wordle — event sourcing (replay, undo, redo)", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "replaying the log rebuilds byte-identical state", async () => {
		const engine = await bootWordle( memory, { config: { wordCount: 2 } } );
		const wrong = wrongGuesses( memory, 3 );
		await run( memory, engine.guess( { guess: wrong[ 0 ]! }, P1 ) );
		await run( memory, engine.guess( { guess: wrong[ 1 ]! }, P1 ) );
		await run( memory, engine.guess( { guess: wrong[ 2 ]! }, P1 ) );

		const before = structuredClone( persisted( memory ) );

		// Rewind to genesis and replay every commit — the refold must land exactly
		// where the incremental fold did.
		for ( let i = 0; i < 3; i++ ) {
			await run( memory, engine.undo( P1 ) );
		}

		for ( let i = 0; i < 3; i++ ) {
			await run( memory, engine.redo( P1 ) );
		}

		expect( persisted( memory ) ).toEqual( before );
	} );

	test( "the same seed draws the same answers", async () => {
		// `setup` draws from the engine's seeded stream, so the same seed always
		// picks the same answers and a genesis replay is reproducible.
		const a = makeMemory();
		const b = makeMemory();
		await bootWordle( a, { start: false } );
		await bootWordle( b, { start: false } );

		expect( answers( a ) ).toEqual( answers( b ) );

		// ...and a different seed draws different answers, so the assertion above
		// is about the seed rather than a constant.
		const c = makeMemory();
		await bootWordle( c, { start: false, seed: "another-seed" } );
		expect( answers( c ) ).not.toEqual( answers( a ) );
	} );

	test( "undo rewinds the last guess and its scored rows", async () => {
		const engine = await bootWordle( memory );
		const wrong = wrongGuesses( memory, 2 );
		await run( memory, engine.guess( { guess: wrong[ 0 ]! }, P1 ) );
		await run( memory, engine.guess( { guess: wrong[ 1 ]! }, P1 ) );

		const snapshot = await run( memory, engine.undo( P1 ) );
		expect( snapshot.view.guesses ).toEqual( [ wrong[ 0 ]! ] );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.guesses ).toEqual( [ wrong[ 0 ]! ] );
		expect( state.context.turn ).toBe( 1 );
		expect( persisted( memory ).state.guessResults[ answers( memory )[ 0 ]! ] )
			.toHaveLength( 1 );
	} );

	test( "undo un-wins a won game and redo wins it again", async () => {
		const engine = await bootWordle( memory );
		await run( memory, engine.guess( { guess: answers( memory )[ 0 ]! }, P1 ) );
		expect( ( await run( memory, engine.getState( P1.id ) ) ).status ).toBe( "COMPLETED" );

		const undone = await run( memory, engine.undo( P1 ) );
		expect( undone.status ).toBe( "IN_PROGRESS" );
		expect( undone.view.victory ).toBeUndefined();
		expect( undone.view.guesses ).toEqual( [] );

		const redone = await run( memory, engine.redo( P1 ) );
		expect( redone.status ).toBe( "COMPLETED" );
		expect( redone.view.victory ).toBe( true );
	} );

	test( "undo before the first guess fails with NothingToUndo", async () => {
		// Wordle's only commits before a guess are `join` + `start`, and the floor
		// sits at `start` — so the sole player is told there is nothing to undo
		// rather than being rewound out of their own roster and locked out.
		const engine = await bootWordle( memory );

		expect( ( await runFail( memory, engine.undo( P1 ) ) )._tag ).toBe( "swish/NothingToUndo" );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( Object.keys( state.players ) ).toEqual( [ P1.id ] );
	} );

	test( "a fresh guess after an undo drops the redo tail", async () => {
		const engine = await bootWordle( memory );
		const wrong = wrongGuesses( memory, 2 );
		await run( memory, engine.guess( { guess: wrong[ 0 ]! }, P1 ) );
		await run( memory, engine.undo( P1 ) );
		await run( memory, engine.guess( { guess: wrong[ 1 ]! }, P1 ) );

		expect( ( await runFail( memory, engine.redo( P1 ) ) )._tag ).toBe( "swish/NothingToRedo" );
		expect( ( await run( memory, engine.getState( P1.id ) ) ).view.guesses )
			.toEqual( [ wrong[ 1 ]! ] );
	} );

	test( "cleanup clears the board", async () => {
		const engine = await bootWordle( memory );
		await run( memory, engine.cleanup() );

		expect( memory.store.value ).toBeNull();
		expect( ( await runFail( memory, engine.getState( P1.id ) ) )._tag )
			.toBe( "swish/GameNotFound" );
	} );
} );
