import { produce } from "immer";

import { dictionaries } from "@/games/wordle/dictionary";
import {
	DecidedEvent,
	ForfeitedEvent,
	GuessedEvent,
	WORDLE_BOT_DELAY_MILLIS,
	WORDLE_MAX_WORD_COUNT,
	WORDLE_MOVE_TIMEOUT_MILLIS,
	WordleConfig,
	WordleEvents,
	WordleMoveSchemas,
	WordleState,
	WordleView
} from "@/games/wordle/schema";
import { decideWordleMove } from "@/games/wordle/server/bot/policy";
import {
	boardFor,
	guessesOf,
	hasFinished,
	isValidWord,
	maxGuessesFor,
	nextUnfinishedSeat,
	normalizeGuess,
	scoreFor
} from "@/games/wordle/utils";
import { InvalidMove } from "@/swish/errors";
import type { PlayerId } from "@/swish/schema";
import { Standing, Standings } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";
import { playerIdFor } from "@/swish/utils";


/**
 * The wordle game's runtime, built from its declarative structure.
 *
 * Yielding it builds the command surface the API layer drives the game through —
 * the lifecycle commands, `submitMove`, the history cursor and `getView`.
 *
 * The type arguments are inferred rather than written out, and only from the
 * literal at this call site: `schemas.moves` is a homomorphic mapped type, so
 * TypeScript recovers `MoveInputs` from the object literal there and feeds it to
 * the contravariant `MoveInputs[K][ "Type" ]` positions in each move's
 * `validate`/`execute`. Lift the structure out to a `const` of its own and every
 * one of those inference sites is gone — the callback parameters fall back to
 * `any` and the structure stops being assignable. Which is why it is written
 * here, inline.
 *
 * What makes this game unusual among the engine's is that it is a *race*. Every
 * seat works the same hidden words on a board of its own and nobody waits for a
 * turn, so both moves override `canMove` to admit any seat that has not
 * finished. That override is also what has the engine race the bots: every
 * machine-played seat guesses on one shared clock instead of waiting its turn.
 * The cursor is kept all the same — see `resolveNextPlayer` — but it only says
 * whose timeout is running.
 */
export const {
	Engine: WordleEngine,
	EngineLive: WordleEngineLive,
	Structure: WordleStructure
} = makeEngine( {
	name: "wordle",

	schemas: {
		state: WordleState,
		config: WordleConfig,
		events: WordleEvents,
		view: WordleView,
		moves: WordleMoveSchemas
	},

	/**
	 * Solitaire at the classic shape: one seat, one five-letter word, started the
	 * moment it is created because there is nobody else to wait for.
	 *
	 * A wordle only ends once every board is finished, so a seat that walks away
	 * holds the rest of the table at it forever. Handing that seat to `botMove`
	 * through `autoPlay` is the way out of it.
	 */
	defaultConfig: () => WordleConfig.make( {
		playerCount: 1,
		wordCount: 1,
		wordLength: 5,
		autoStart: true,
		botDelayMillis: WORDLE_BOT_DELAY_MILLIS,
		moveTimeoutMillis: WORDLE_MOVE_TIMEOUT_MILLIS
	} ),

	/**
	 * Draws the words the table hides. `setup` runs at creation, when nobody
	 * has joined yet, so nothing per-seat can be seeded here — `guesses` starts
	 * empty and fills in as seats actually play, which is why every read of it
	 * goes through `guessesOf`.
	 *
	 * Drawn by shuffling the dictionary and taking a prefix rather than by
	 * sampling indices until enough distinct words come up: the prefix is distinct
	 * by construction and the work is bounded, where rejection sampling is a loop
	 * whose length nothing in the config bounds. `WORDLE_MAX_WORD_COUNT` is
	 * already enforced by `WordCount`, and clamping again here costs nothing and
	 * keeps the draw finite whatever reaches it.
	 */
	setup: ( config, rng ) => WordleState.make( {
		words: rng( "words" )
			.shuffle( dictionaries[ config.wordLength ] )
			.slice( 0, Math.min( config.wordCount, WORDLE_MAX_WORD_COUNT ) ),
		guesses: {},
		forfeited: [],
		decided: false
	} ),

	/**
	 * The whole of the game's history is the guesses played and the seats that
	 * gave up. Everything a client reads — the scored rows, the tallies, whether a
	 * seat is finished — is derived from those on the way out, in `utils.ts`, so
	 * there is only ever one copy of it and no second record to fall out of step.
	 */
	apply: ( state, event ) => produce( state, draft => {
		switch ( event._tag ) {
			case "wordle/ev/Guessed":
				draft.guesses[ event.playerId ] = [
					...guessesOf( state, event.playerId ),
					event.guess
				];
				return;

			case "wordle/ev/Forfeited":
				draft.forfeited.push( event.playerId );
				return;

			case "wordle/ev/Decided":
				draft.decided = true;
		}
	} ),

	/**
	 * Over when there is nothing left for anyone to play. A race ends last rather
	 * than first: a seat that solves everything early is simply done, and the
	 * others keep their allowance.
	 *
	 * The roster is checked for emptiness because `every` on an empty list is
	 * `true` — the engine only asks this at `start` and after a move, both of
	 * which have seats, but a table with no players has not finished, it has not
	 * begun.
	 */
	endIf: ( { state, config, context } ) => context.players.length > 0
		&& context.players.every( playerId => hasFinished( state, config, playerId ) ),

	/**
	 * Unsealing the answers is the whole of what ending does to the state. The
	 * verdict itself is `resolveResults`' alone — writing a second copy of it into
	 * the state would be a record that could only ever disagree.
	 */
	hooks: {
		onEnd: () => [ DecidedEvent.make( {} ) ]
	},

	/**
	 * Ranked by score, highest first. Ties share a rank — `1 +` however many seats
	 * strictly outscored you — so two seats that solved the same words at the same
	 * cost come second together rather than being separated by the order the
	 * sort happened to leave them in.
	 *
	 * A `winner` is named only when the top score is held by exactly one seat.
	 * Everything that decides a wordle is already in `scoreFor`: words solved
	 * first, efficiency after, packed into a single integer.
	 */
	resolveResults: ( { state, config, context } ) => {
		const scoreOf = ( playerId: PlayerId ) => scoreFor( state, config, playerId );

		const ranking = [ ...context.players ]
			.sort( ( left, right ) => scoreOf( right ) - scoreOf( left ) )
			.map( playerId => Standing.make( {
				playerId,
				rank: 1 + context.players.filter( other => scoreOf( other ) > scoreOf( playerId ) ).length,
				score: scoreOf( playerId )
			} ) );

		const best = Math.max( ...context.players.map( scoreOf ) );
		const leaders = context.players.filter( playerId => scoreOf( playerId ) === best );

		return Standings.make( {
			ranking,
			winner: leaders.length === 1 ? leaders[ 0 ] : undefined
		} );
	},

	/**
	 * One shape for every audience: a board per seat, the audience's own filled in
	 * and the rest published as tallies. `boardFor` is what draws that line, and
	 * it is the only place that knows where it falls — a rival's rows would leak,
	 * since every seat races the *same* words.
	 *
	 * `answers` is the one field that appears rather than changes, and it appears
	 * only once `Decided` has been folded, so a player who ran out of guesses
	 * learns what they were chasing and nobody learns it a moment sooner.
	 */
	view: ( data, audience ) => WordleView.make( {
		maxGuesses: maxGuessesFor( data.config ),
		boards: data.context.players.map( playerId => boardFor( data, playerId, audience ) ),
		decided: data.state.decided,
		answers: data.state.decided ? data.state.words : undefined,
		playerId: playerIdFor( audience )
	} ),

	moves: {
		guess: {

			/**
			 * The race, stated: anyone still holding allowance may guess, whoever the
			 * cursor is on. Without this every seat but one would be told it was not
			 * their turn, and a table of people would take its guesses in single file.
			 */
			canMove: ( { state, config }, playerId ) => !hasFinished( state, config, playerId ),

			validate: ( { state, config }, playerId, input ) => {
				if ( hasFinished( state, config, playerId ) ) {
					return new InvalidMove( {
						move: "guess",
						reason: "You have no guesses left."
					} );
				}

				const guess = normalizeGuess( input.guess );

				if ( guess.length !== config.wordLength ) {
					return new InvalidMove( {
						move: "guess",
						reason: `A guess must be ${ config.wordLength } letters long.`
					} );
				}

				if ( !isValidWord( guess, config.wordLength ) ) {
					return new InvalidMove( {
						move: "guess",
						reason: `"${ guess }" is not a word this table knows.`
					} );
				}

				return;
			},

			/**
			 * The normalized guess is what goes into the log, not what was typed. The
			 * rows are scored against it on every read, and the dictionaries are
			 * lowercase — a guess stored in the case it arrived in would score as a word
			 * the table does not hold.
			 */
			execute: ( _data, playerId, input ) => [
				GuessedEvent.make( { playerId, guess: normalizeGuess( input.guess ) } )
			]
		},

		forfeit: {
			canMove: ( { state, config }, playerId ) => !hasFinished( state, config, playerId ),

			validate: ( { state, config }, playerId ) => hasFinished( state, config, playerId )
				? new InvalidMove( {
					move: "forfeit",
					reason: "You have already finished."
				} )
				: undefined,

			/**
			 * Giving up is recorded and nothing else. What it *costs* — the rest of the
			 * allowance, charged in full — is read off `state.forfeited` by
			 * `guessesSpentBy`, so the price lives with the scoring rather than being
			 * baked into an event that a later rule change could not revise.
			 */
			execute: ( _data, playerId ) => [ ForfeitedEvent.make( { playerId } ) ]
		}
	},

	/**
	 * The cursor grants nothing here — `canMove` already lets every unfinished
	 * seat play — and it does not pace the bots either, which race on the
	 * engine's shared clock. What it still does is say whose timeout is running,
	 * and it is only asked to move when the seat it is on guesses. A finished seat
	 * holding it would stall a table nothing could advance, so
	 * `nextUnfinishedSeat` skips those.
	 */
	resolveNextPlayer: ( data, playerId ) => nextUnfinishedSeat( data, playerId ),

	/**
	 * The policy sees the seat's own redacted view and nothing else: not the
	 * answers, and not a rival's rows. Everything it knows about a hidden word is
	 * the rows that word has scored on its own board, which is exactly what a
	 * person at that seat knows.
	 */
	botMove: decideWordleMove
} );
