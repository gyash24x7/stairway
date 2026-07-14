// @s2h/wordle/swish — Wordle as an event-sourced swish game.
//
// The swish port of ./engine.ts (the old `AbstractGameEngine` DO). Same rules,
// re-expressed under event sourcing: the `guess` move EMITS a domain event
// carrying the computed per-word results, and a pure `apply` reducer folds it
// onto `state` (the only place state changes). Random target selection happens
// once in `setup` and its result becomes the genesis state (deterministic on
// replay). The dictionary is reused as-is for validation.

import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { BasePlayerView } from "@s2h/swish/schema";
import { defineGame } from "@s2h/swish/structure";
import * as Effect from "effect/Effect";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { dictionaries } from "./dictionary";
import {
	GuessedEvent,
	GuessInput,
	GuessRow,
	VictoryDecidedEvent,
	WordleConfig,
	WordleEvent,
	WordleSharedView,
	WordleSnapshot,
	WordleState
} from "./schema";
import { allWordsGuessed, apply, computeRow } from "./utils";

// --- Engine ----------------------------------------------------------------

export const wordle = makeEngine(
	defineGame( {
		name: "wordle",
		stateSchema: WordleState,
		configSchema: WordleConfig,
		sharedViewSchema: WordleSharedView,
		playerViewSchema: BasePlayerView,
		eventSchema: WordleEvent,
		apply,

		setup: ( config ) => Effect.sync( () => {
			const wordLength = config.wordLength;
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
				{} as Record<string, ReadonlyArray<typeof GuessRow.Type>>
			);
			return { words, guesses: [], guessResults, maxGuesses };
		} ),

		endIf: ( { state } ) =>
			Effect.succeed( allWordsGuessed( state ) || state.guesses.length === state.maxGuesses ),

		sharedView: ( { state, config } ) => Effect.sync( () => {
			const emptyRow: typeof GuessRow.Type = Array.from(
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
		resolveNextPlayer: ( _data, playerId ) => Effect.succeed( playerId ),

		hooks: {
			onEnd: ( { state } ) =>
				Effect.succeed( [
					VictoryDecidedEvent.make( { victory: allWordsGuessed( state ) } )
				] )
		},

		moves: {
			guess: {
				input: GuessInput,
				validate: ( { state, config }, _playerId, { guess } ) => {
					if ( state.guesses.length >= state.maxGuesses ) {
						return Effect.fail( new InvalidMove( {
							move: "guess",
							reason: "No more guesses left"
						} ) );
					}
					const dictionary = dictionaries[ config.wordLength ];
					if ( !dictionary.includes( guess ) ) {
						return Effect.fail(
							new InvalidMove( { move: "guess", reason: "The guess is not a valid word" } )
						);
					}
					return Effect.void;
				},
				execute: ( { state }, _playerId, { guess } ) =>
					Effect.succeed( [
						GuessedEvent.make( {
							guess,
							rows: state.words.map( ( word ) => computeRow( guess, word ) )
						} )
					] )
			}
		}
	} )
);

// --- RPC surface -----------------------------------------------------------

export class WordleRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( WordleConfig ),
	EngineRpc.makeGetState( WordleSnapshot ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "guess", GuessInput ),
	EngineRpc.makeUndo( WordleSnapshot ),
	EngineRpc.makeRedo( WordleSnapshot )
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