// @s2h/wordle/swish — Wordle as an event-sourced swish game.
//
// The swish port of ./engine.ts (the old `AbstractGameEngine` DO). Same rules,
// re-expressed under event sourcing: the `guess` move EMITS a domain event
// carrying the computed per-word results, and a pure `apply` reducer folds it
// onto `state` (the only place state changes). Random target selection happens
// once in `setup` and its result becomes the genesis state (deterministic on
// replay). The dictionary is reused as-is for validation.

import { Effect, Match, Schema } from "effect";
import { RpcGroup } from "effect/unstable/rpc";
import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { PlayerId } from "@s2h/swish/schema";
import { defineGame } from "@s2h/swish/structure";
import { dictionaries } from "./dictionary";
import type { WordLength } from "./types";

// --- Schemas ---------------------------------------------------------------

const LetterStatus = Schema.Literals( [ "correct", "present", "absent" ] );
const GuessResult = Schema.Struct( { letter: Schema.String, status: LetterStatus } );
/** Results for one guess against one word (one entry per letter). */
const GuessRow = Schema.Array( GuessResult );
/** All guess rows accumulated against a single word. */
const GuessResultsForWord = Schema.Array( GuessRow );
const WordLengthSchema = Schema.Literals( [ 4, 5, 6 ] );

export const WordleConfig = Schema.Struct( {
	playerCount: Schema.Number,
	autoStart: Schema.optional( Schema.Boolean ),
	wordCount: Schema.Number,
	wordLength: WordLengthSchema
} );

export const WordleState = Schema.Struct( {
	words: Schema.Array( Schema.String ),
	guesses: Schema.Array( Schema.String ),
	// Map of target word -> its accumulated guess rows.
	guessResults: Schema.Record( Schema.String, GuessResultsForWord ),
	maxGuesses: Schema.Number,
	victory: Schema.optional( Schema.Boolean )
} );

/** Shared view: hides target words + raw map, exposes processed padded rows. */
export const WordleShared = Schema.Struct( {
	guesses: Schema.Array( Schema.String ),
	maxGuesses: Schema.Number,
	victory: Schema.optional( Schema.Boolean ),
	guessResults: Schema.Array( GuessResultsForWord )
} );

export const WordlePlayer = Schema.Struct( { playerId: PlayerId } );
export const GuessInput = Schema.Struct( { guess: Schema.String } );

type WordleState = typeof WordleState.Type;
type GuessResultType = typeof GuessResult.Type;
type GuessRowType = typeof GuessRow.Type;

// --- Guess-result computation (pure) ---------------------------------------
// The two-pass algorithm from the old `execute`, lifted into a pure helper so
// it can run in the decider and its output is captured in the emitted event.

const computeRow = ( guess: string, word: string ): GuessRowType => {
	const results: GuessResultType[] = Array.from(
		{ length: word.length },
		( _, i ) => ( { letter: guess[ i ] ?? "", status: "absent" as const } )
	);

	const remaining: Record<string, number> = {};
	for ( const ch of word ) {
		remaining[ ch ] = ( remaining[ ch ] ?? 0 ) + 1;
	}

	// Pass 1: mark correct matches.
	for ( let i = 0; i < word.length; i++ ) {
		if ( guess[ i ] === word[ i ] ) {
			results[ i ] = { letter: guess[ i ]!, status: "correct" };
			remaining[ guess[ i ]! ]!--;
		}
	}

	// Pass 2: mark present letters from the remaining pool.
	for ( let i = 0; i < word.length; i++ ) {
		if ( results[ i ]!.status !== "correct" && ( remaining[ guess[ i ]! ] ?? 0 ) > 0 ) {
			results[ i ] = { letter: guess[ i ]!, status: "present" };
			remaining[ guess[ i ]! ]!--;
		}
	}

	return results;
};

const allWordsGuessed = ( state: WordleState ): boolean =>
	state.words.every( ( word ) => state.guesses.includes( word ) );

// --- Domain events + reducer -----------------------------------------------

// The guess + its computed per-word rows are captured so replay is exact.
const Guessed = Schema.TaggedStruct( "wordle/Guessed", {
	guess: Schema.String,
	// One row per target word, in `state.words` order.
	rows: Schema.Array( GuessRow )
} );
const VictoryDecided = Schema.TaggedStruct( "wordle/VictoryDecided", { victory: Schema.Boolean } );

const WordleEvent = Schema.Union( [ Guessed, VictoryDecided ] );
type WordleEvent = typeof WordleEvent.Type;

/** Pure reducer — the ONLY place `state` changes. */
const apply = ( state: WordleState, event: WordleEvent ): WordleState =>
	Match.value( event ).pipe(
		Match.tag( "wordle/Guessed", ( e ) => {
			const guesses = [ ...state.guesses, e.guess ];
			const guessResults: Record<string, ReadonlyArray<GuessRowType>> = { ...state.guessResults };
			state.words.forEach( ( word, i ) => {
				guessResults[ word ] = [ ...( guessResults[ word ] ?? [] ), e.rows[ i ]! ];
			} );
			return { ...state, guesses, guessResults };
		} ),
		Match.tag( "wordle/VictoryDecided", ( e ) => ( { ...state, victory: e.victory } ) ),
		Match.exhaustive
	);

// --- Engine ----------------------------------------------------------------

export const wordle = makeEngine(
	defineGame( {
		name: "wordle",
		stateSchema: WordleState,
		configSchema: WordleConfig,
		sharedViewSchema: WordleShared,
		playerViewSchema: WordlePlayer,
		eventSchema: WordleEvent,
		apply,

		setup: ( config ) => Effect.sync( () => {
			const wordLength = config.wordLength as WordLength;
			const dictionary = dictionaries[ wordLength ];
			const maxGuesses = config.wordCount + config.wordLength;
			const selected = new Set<string>();
			while ( selected.size < config.wordCount ) {
				selected.add( dictionary[ Math.floor( Math.random() * dictionary.length ) ]! );
			}
			const words = [ ...selected ];
			const guessResults = words.reduce(
				( acc, word ) => {
					acc[ word ] = [];
					return acc;
				},
				{} as Record<string, ReadonlyArray<GuessRowType>>
			);
			return { words, guesses: [], guessResults, maxGuesses };
		} ),

		endIf: ( { state } ) =>
			Effect.succeed( allWordsGuessed( state ) || state.guesses.length === state.maxGuesses ),

		sharedView: ( { state, config } ) => Effect.sync( () => {
			const emptyRow: GuessRowType = Array.from(
				{ length: config.wordLength },
				() => ( { letter: "", status: "absent" as const } )
			);
			return {
				guesses: state.guesses,
				maxGuesses: state.maxGuesses,
				victory: state.victory,
				guessResults: state.words.map( ( word ) => {
					const results = state.guessResults[ word ] ?? [];
					const solvedAt = results.findIndex(
						( row ) => row.every( ( r ) => r.status === "correct" )
					);
					const truncated = solvedAt !== -1 ? results.slice( 0, solvedAt + 1 ) : results;
					return [
						...truncated,
						...Array.from( { length: state.maxGuesses - truncated.length }, () => emptyRow )
					];
				} )
			};
		} ),

		playerView: ( _data, playerId ) => Effect.succeed( { playerId } ),
		// Single-player: the same player always plays next.
		resolveNextPlayer: ( _data, playerId ) => Effect.succeed( playerId ),

		hooks: {
			onEnd: ( { state } ) =>
				Effect.succeed( [
					VictoryDecided.make( { victory: allWordsGuessed( state ) } )
				] )
		},

		moves: {
			guess: {
				input: GuessInput,
				validate: ( { state, config }, _playerId, { guess } ) => {
					if ( state.guesses.length >= state.maxGuesses ) {
						return Effect.fail( new InvalidMove( { move: "guess", reason: "No more guesses left" } ) );
					}
					const dictionary = dictionaries[ config.wordLength as WordLength ];
					if ( !dictionary.includes( guess ) ) {
						return Effect.fail(
							new InvalidMove( { move: "guess", reason: "The guess is not a valid word" } )
						);
					}
					return Effect.void;
				},
				execute: ( { state }, _playerId, { guess } ) =>
					Effect.succeed( [
						Guessed.make( { guess, rows: state.words.map( ( word ) => computeRow( guess, word ) ) } )
					] )
			}
		}
	} )
);

// --- RPC surface -----------------------------------------------------------

export class WordleRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( WordleConfig ),
	EngineRpc.makeGetState( WordleShared, WordlePlayer ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "guess", GuessInput ),
	EngineRpc.makeUndo( WordleShared, WordlePlayer ),
	EngineRpc.makeRedo( WordleShared, WordlePlayer )
) {
	public static layer = WordleRpcs.toLayer( {
		initialize: wordle.initialize,
		getState: wordle.getState,
		join: wordle.join,
		addBots: wordle.addBots,
		start: wordle.start,
		undo: wordle.undo,
		redo: wordle.redo,
		guess: ( { playerInfo, input } ) => wordle.submitMove( "guess", playerInfo, input )
	} );
}
