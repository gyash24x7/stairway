import * as Schema from "effect/Schema";

import {
	BaseGameConfig,
	InitializeInput,
	PlayerId,
	PositiveInt,
	SeatView
} from "@/swish/shared/schema.ts";

import type { GameData } from "@/swish/shared/schema.ts";


// --- Enumerations ----------------------------------------------------------

/**
 * What one letter of a guess scored against one hidden word:
 * - correct: The letter is in the word, at this position
 * - present: The letter is in the word, at some other position
 * - absent: The word has no unmatched copy of this letter left
 */
export type LetterStatus = typeof LetterStatus.Type;
export const LetterStatus = Schema.Literals( [ "correct", "present", "absent" ] );

/**
 * The word lengths a table may play at. Each has a dictionary of its own, which
 * is what bounds the set: a length without one is a length no game can hide a
 * word for, nor accept a guess at.
 */
export type WordLength = typeof WordLength.Type;
export const WordLength = Schema.Literals( [ 4, 5, 6 ] );


// --- Board Primitives ------------------------------------------------------

/**
 * What one guess scored against one hidden word, one status per position.
 *
 * The letters are deliberately not here: position `i` scored `guess[ i ]`, and
 * the guess itself is on the view, so carrying them would be one copy of the
 * same character per hidden word.
 */
export type GuessRow = typeof GuessRow.Type;
export const GuessRow = Schema.Array( LetterStatus );

/**
 * Every row one hidden word has scored, in guess order — so `column[ i ]` is
 * always the row for `guesses[ i ]`.
 *
 * A column shorter than the guesses played means that word was solved, at its
 * last index. It is never padded out to the table's allowance: a filler row
 * would sit at an index a real guess already owns, and would mislabel every row
 * past the solve.
 */
export type WordColumn = typeof WordColumn.Type;
export const WordColumn = Schema.Array( GuessRow );

/**
 * A guess allowance. Never zero: it is `wordCount + wordLength`, both positive.
 */
const GuessCount = Schema.Int.check( Schema.isGreaterThanOrEqualTo( 1 ) );

/**
 * A tally of something a player has spent — guesses, letters, words solved.
 */
const Tally = PositiveInt;

/**
 * How many words a table may hide at once. Bounded because `setup` draws
 * distinct words in a loop: an unbounded count would either spin forever once
 * it exceeded the dictionary, or hand out a board no one could finish.
 */
export const WORDLE_MAX_WORD_COUNT = 8;

/**
 * How many words a table hides, bounded by `WORDLE_MAX_WORD_COUNT`.
 */
export type WordCount = typeof WordCount.Type;
export const WordCount = Schema.Int.check(
	Schema.isGreaterThanOrEqualTo( 1 ),
	Schema.isLessThanOrEqualTo( WORDLE_MAX_WORD_COUNT )
);


// --- Config / State / Views ------------------------------------------------

/**
 * How many seats a table may have. One is solitaire; more is a duel, where every
 * seat races the same hidden words on a board of its own.
 */
export const WORDLE_MAX_PLAYER_COUNT = 8;

/**
 * How many players a table seats, bounded by `WORDLE_MAX_PLAYER_COUNT`.
 */
export type WordlePlayerCount = typeof WordlePlayerCount.Type;
export const WordlePlayerCount = Schema.Int.check(
	Schema.isGreaterThanOrEqualTo( 1 ),
	Schema.isLessThanOrEqualTo( WORDLE_MAX_PLAYER_COUNT )
);

/**
 * What a table was created with. Extends `BaseGameConfig`
 * - playerCount: How many seats race these words. One is solitaire
 * - wordCount: How many words this table hides
 * - wordLength: How long each of those words is
 */
export type WordleConfig = typeof WordleConfig.Type;
export const WordleConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	playerCount: WordlePlayerCount,
	wordCount: WordCount,
	wordLength: WordLength
} );

/**
 * The words the table hides, and what each seat has spent on them. Every seat
 * races the same words — that is what makes the scores comparable — but keeps
 * its own guess list.
 *
 * - words: The hidden words, in the order `setup` drew them
 * - guesses: Each player's guesses, in the order they played them. A player who
 * 			has not guessed yet has no entry at all, so read it through `guessesOf`
 * - forfeited: The players who gave up. Forfeiting gives up the rest of the
 * 			allowance rather than banking it, so these seats are charged the full
 * 			amount and count as spent
 * - decided: Whether the game is over, written by `Decided`. This is the only
 * 			way a view learns the game ended, since `GameContext` carries no status
 */
export type WordleState = typeof WordleState.Type;
export const WordleState = Schema.Struct( {
	words: Schema.Array( Schema.String ),
	guesses: Schema.Record( PlayerId, Schema.Array( Schema.String ) ),
	forfeited: Schema.Array( PlayerId ),
	decided: Schema.Boolean
} );

/**
 * One seat's board, as some audience is allowed to see it. Every audience gets
 * one of these per seat, so a client renders the table and its own board with
 * the same code.
 *
 * A rival's board is published as tallies rather than grids: `guesses` and
 * `results` are empty for a seat you are not entitled to read, and `guessCount`
 * is what carries its size. Sending a rival's rows would leak, because every
 * seat races the *same* words — a rival column going all-`correct` names the
 * guess that solved it, and its rows against the words you have left are then
 * free scored probes of a word you know.
 *
 * - playerId: The seat this board belongs to
 * - guessCount: How many guesses this seat actually played. Always populated.
 * 			A seat that forfeited is *charged* for its whole allowance, which shows
 * 			in `score` rather than here — this stays a count of real guesses, since
 * 			it is what a client lays the grid out from
 * - solvedWords: Per hidden word, whether this seat has solved it
 * - lettersUsed: How many distinct letters this seat has spent
 * - finished: Whether this seat can still move
 * - score: What this seat would score if the game ended now
 * - guesses: The words this seat guessed. Empty unless the board is the
 * 			audience's own, or the game is decided
 * - results: One column per hidden word, index-aligned with `guesses`. Empty
 * 			under exactly the same condition
 */
export type Board = typeof Board.Type;
export const Board = Schema.Struct( {
	playerId: PlayerId,
	guessCount: Tally,
	solvedWords: Schema.Array( Schema.Boolean ),
	lettersUsed: Tally,
	finished: Schema.Boolean,
	score: Schema.Int,
	guesses: Schema.Array( Schema.String ),
	results: Schema.Array( WordColumn )
} );

/**
 * One shape for every audience. What varies between them is which boards are
 * filled in, not which fields exist — the table's view is every board redacted,
 * a player's is their own board open and the rest redacted, and once the game is
 * decided every audience sees every board.
 *
 * - maxGuesses: How many guesses each seat is allowed
 * - boards: One per seat, in join order
 * - decided: Whether the game is over
 * - answers: The words themselves, revealed in `boards`' word order once the
 * 			game is decided, so a player who ran out of guesses learns what they
 * 			were chasing. The one field that appears rather than changes
 * - playerId: The seat this view was built for. Absent on the table's, and the
 * 			only thing telling a client which board is its own
 */
export type WordleView = typeof WordleView.Type;
export const WordleView = Schema.Struct( {
	maxGuesses: GuessCount,
	boards: Schema.Array( Board ),
	decided: Schema.Boolean,
	answers: Schema.optional( Schema.Array( Schema.String ) ),
	playerId: Schema.optional( PlayerId )
} );

/** The table as one of its seats sees it — {@link SeatView} over the view above. */
export type WordleSeatView = typeof WordleSeatView.Type;
export const WordleSeatView = SeatView( WordleView );

/**
 * What the bot decides from. The engine only ever plays a seat through that
 * seat's own audience, so the policy narrows to `WordleSeatView` once on the way
 * in and reads its board — the only one carrying rows — from there. It never
 * learns more than the player it is playing for: not the answers, and not a
 * rival's rows.
 */
export type WordleBotData = GameData<WordleSeatView, WordleConfig>;


// --- Move Inputs -----------------------------------------------------------

/**
 * The input required to play a guess.
 * - guess: The word being guessed, in any case and with any surrounding space
 */
export type GuessInput = typeof GuessInput.Type;
export const GuessInput = Schema.Struct( { guess: Schema.String } );

/**
 * The input required to forfeit: none. The seat giving up is the caller's own,
 * extracted from the authentication information.
 */
export type ForfeitInput = typeof ForfeitInput.Type;
export const ForfeitInput = Schema.Struct( {} );

/**
 * The input required to initialize a Wordle game.
 */
export type WordleInitializeInput = typeof WordleInitializeInput.Type;
export const WordleInitializeInput = InitializeInput( WordleConfig );

/**
 * The input required to create a Wordle game. The id, the code and the seed are
 * the server's to pick, so a client chooses only the shape of the board.
 * - playerCount: How many seats to open. One is solitaire
 * - wordCount: How many words the game should hide
 * - wordLength: How long each of those words should be
 */
export type WordleCreateInput = typeof WordleCreateInput.Type;
export const WordleCreateInput = Schema.Struct( {
	playerCount: WordlePlayerCount,
	wordCount: WordCount,
	wordLength: WordLength
} );


// --- Domain Events ---------------------------------------------------------

/**
 * Emitted when a player plays a guess the game accepts.
 * Appends it to that player's guesses.
 */
export type GuessedEvent = typeof GuessedEvent.Type;
export const GuessedEvent = Schema.TaggedStruct( "wordle/ev/Guessed", {
	playerId: PlayerId,
	guess: Schema.String
} );

/**
 * Emitted when a player gives up with allowance still in hand.
 * Forfeits the rest of it, which both retires the seat and charges it in full.
 */
export type ForfeitedEvent = typeof ForfeitedEvent.Type;
export const ForfeitedEvent = Schema.TaggedStruct( "wordle/ev/Forfeited", {
	playerId: PlayerId
} );

/**
 * Emitted when the game ends, which is what stops the words being secret.
 * It records no verdict: every seat's placing is its own, and comes out of
 * `resolveResults` rather than state.
 */
export type DecidedEvent = typeof DecidedEvent.Type;
export const DecidedEvent = Schema.TaggedStruct( "wordle/ev/Decided", {} );

/**
 * Union of all the events a Wordle game emits
 */
export type WordleEvents = typeof WordleEvents.Type;
export const WordleEvents = Schema.Union( [ GuessedEvent, ForfeitedEvent, DecidedEvent ] );
