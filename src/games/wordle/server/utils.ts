import { Board } from "@/games/wordle/shared/schema.ts";
import { playerIdFor } from "@/swish/server/utils.ts";

import type {
	LetterStatus,
	WordleConfig,
	WordleState
} from "@/games/wordle/shared/schema.ts";
import type { Audience, GameData, PlayerId } from "@/swish/shared/schema.ts";

// --- Board arithmetic ------------------------------------------------------

/**
 * How many guesses each seat gets: one per hidden word, on top of the classic
 * allowance of one more guess than the word is long.
 *
 * @param config - The table's config.
 * @returns The number of guesses each seat is allowed.
 */
export const maxGuessesFor = ( config: WordleConfig ) => config.wordCount + config.wordLength;

/**
 * One seat's guesses, in the order it played them.
 *
 * Every read of `state.guesses` must come through here. `setup` runs at
 * `initialize`, before anyone has joined, so it cannot seed the record with
 * player keys — and `noUncheckedIndexedAccess` is off, so indexing it types as
 * a present array while actually handing back `undefined` for a seat that has
 * not guessed yet.
 *
 * @param state - The current state.
 * @param playerId - The seat to read.
 * @returns That seat's guesses, empty if it has played none.
 */
export const guessesOf = ( state: WordleState, playerId: PlayerId ) =>
	state.guesses[ playerId ] ?? [];


// --- Dictionary lookup -----------------------------------------------------

// Both live in `shared/utils.ts` now: the client refuses an unknown word before
// spending a round trip on it, and it has to do that against the list the engine
// actually validates with. Re-exported so this module stays the engine's one
// import for guess handling.
export { isValidWord, normalizeGuess } from "@/games/wordle/shared/utils.ts";


// --- Guess-result computation (pure) ---------------------------------------

/**
 * What a guess scores against one hidden word, one status per position — pure
 * in both arguments, which is what lets the board be derived on every read
 * rather than stored.
 *
 * A letter is `present` only while the word has an unmatched copy of it left, so
 * a doubled letter in the guess against a single one in the word marks once.
 *
 * @param guess - The normalized guess, the same length as the word.
 * @param word - The hidden word being scored against.
 * @returns The status of each position of the guess.
 */
export const computeRow = ( guess: string, word: string ) => {
	const statuses: LetterStatus[] = Array.from( { length: word.length }, () => "absent" );

	const remaining: Record<string, number> = {};
	for ( const ch of word ) {
		remaining[ ch ] = ( remaining[ ch ] ?? 0 ) + 1;
	}

	// Pass 1: mark correct matches.
	for ( let i = 0; i < word.length; i++ ) {
		if ( guess[ i ] === word[ i ] ) {
			statuses[ i ] = "correct";
			remaining[ guess[ i ]! ]!--;
		}
	}

	// Pass 2: mark present letters from the remaining pool.
	for ( let i = 0; i < word.length; i++ ) {
		if ( statuses[ i ] !== "correct" && ( remaining[ guess[ i ]! ] ?? 0 ) > 0 ) {
			statuses[ i ] = "present";
			remaining[ guess[ i ]! ]!--;
		}
	}

	return statuses;
};

/**
 * Get the results of the guesses for a player
 * @param state - The current state
 * @param playerId - The seat to read for
 */
export const resultsFor = ( state: WordleState, playerId: PlayerId ) => {
	const guesses = guessesOf( state, playerId );
	return state.words.map( ( word ) => {
		const solvedAt = guesses.indexOf( word );
		const played = solvedAt === -1 ? guesses : guesses.slice( 0, solvedAt + 1 );
		return played.map( ( guess ) => computeRow( guess, word ) );
	} );
};


// --- Per-seat tallies ------------------------------------------------------

/**
 * Which of the hidden words a seat has solved, in the order the words were
 * drawn. A word is solved by being guessed outright, so this is a lookup rather
 * than a scan of the rows it scored.
 *
 * @param state - The current state.
 * @param playerId - The seat to read.
 * @returns One flag per hidden word.
 */
export const solvedWordsFor = ( state: WordleState, playerId: PlayerId ) => {
	const guesses = guessesOf( state, playerId );
	return state.words.map( ( word ) => guesses.includes( word ) );
};

/**
 * How many of the hidden words a seat has solved.
 *
 * @param state - The current state.
 * @param playerId - The seat to read.
 * @returns The count of solved words.
 */
export const solvedCountFor = ( state: WordleState, playerId: PlayerId ) =>
	solvedWordsFor( state, playerId ).filter( Boolean ).length;

/**
 * How much of the alphabet a run of guesses has spent. Distinct letters, so
 * repeating one costs nothing — it is the breadth of the alphabet used that the
 * score prices, not the typing.
 *
 * @param guesses - The guesses to measure.
 * @returns The number of distinct letters across them.
 */
export const lettersUsed = ( guesses: ReadonlyArray<string> ) =>
	new Set( guesses.flatMap( ( guess ) => [ ...guess ] ) ).size;

/**
 * How much of its allowance a seat has spent. Forfeiting gives up the remainder
 * rather than banking it, so a seat that forfeited is charged the lot however
 * few guesses it actually played.
 *
 * That is what stops a table being ended cheaply. If giving up were free, the
 * best play on a hard board would be to do it immediately — every guess costs
 * score and only might earn any — and a duel could finish with the words never
 * seriously attempted. Charging the whole allowance removes the incentive: once
 * a seat is paying for every guess regardless, playing them on is close to
 * free, so the words get contested and a forfeit means only what it says.
 *
 * @param state - The current state.
 * @param config - The table's config.
 * @param playerId - The seat to read.
 * @returns The guesses that seat is charged for.
 */
export const guessesSpentBy = (
	state: WordleState,
	config: WordleConfig,
	playerId: PlayerId
) =>
	state.forfeited.includes( playerId )
		? maxGuessesFor( config )
		: guessesOf( state, playerId ).length;

/**
 * Whether a seat is done — it solved every word, or has no allowance left.
 * A forfeit reaches this through `guessesSpentBy`, which is the whole of what
 * forfeiting does.
 *
 * Derived rather than tracked: a second record of it, in state or in
 * `context.seats`, could only ever disagree with this one.
 *
 * @param state - The current state.
 * @param config - The table's config.
 * @param playerId - The seat to test.
 * @returns `true` when that seat can no longer move.
 */
export const hasFinished = (
	state: WordleState,
	config: WordleConfig,
	playerId: PlayerId
) =>
	solvedCountFor( state, playerId ) === state.words.length
	|| guessesSpentBy( state, config, playerId ) >= maxGuessesFor( config );


/**
 * The seat the engine should wait on next: the first one after the player who
 * just guessed that is still active and can still move, wrapping around.
 *
 * Wordle is a race, so the cursor grants nothing — every seat's `canMove` is
 * `true` whoever holds it, and a player never waits for a turn. What it does is
 * *schedule*: the engine arms its clocks for the seat it is waiting on and plays
 * that one through `botMove`, so a cursor that never moved would leave every
 * machine-played seat but the first unplayable. Rotating it is what lets a bot
 * take its guesses, and pacing it one guess per seat is what keeps the bots
 * racing alongside the table rather than sprinting through their allowance while
 * a person is still typing.
 *
 * A seat that has finished is skipped: it has no move to make, so the bot policy
 * would pass and the table would sit on a cursor nothing can advance. When
 * nobody is left the mover is handed back the cursor, and `endIf` — asked
 * immediately after — ends the game.
 *
 * @param data - The snapshot after the guess.
 * @param from - The player who just moved.
 * @returns The seat to wait on next.
 */
export const nextUnfinishedSeat = (
	{ state, config, context }: GameData<WordleState, WordleConfig>,
	from: PlayerId
) => {
	const order = context.players;
	const start = order.indexOf( from );

	for ( let i = 1; i <= order.length; i++ ) {
		const seat = order[ ( start + i ) % order.length ];
		const status = seat ? context.seats[ seat ] : undefined;

		if ( seat && ( status === undefined || status === "active" )
			&& !hasFinished( state, config, seat ) ) {
			return seat;
		}
	}

	return from;
};


// --- Scoring ---------------------------------------------------------------

/** The letters a guess may be built from, and so the ceiling on `lettersUsed`. */
const ALPHABET_SIZE = 26;

/**
 * The worst a seat's efficiency can cost it: every guess spent, every letter
 * burned.
 *
 * Kept next to `solvePoints`, which is defined as one more than this — **any new
 * penalty term subtracted in `scoreFor` must be added here too**, or solving a
 * word stops strictly outranking efficiency.
 *
 * @param config - The table's config.
 * @returns The largest penalty a seat can accrue.
 */
const maxPenalty = ( config: WordleConfig ) =>
	config.wordLength * maxGuessesFor( config ) + ALPHABET_SIZE;

/**
 * What one solved word is worth. One more than the largest penalty available,
 * so solving an extra word always beats any efficiency advantage — the score
 * packs a lexicographic order into a single integer, and stays one by
 * construction rather than by a hand-tuned constant.
 *
 * @param config - The table's config.
 * @returns The points a single solved word earns.
 */
export const solvePoints = ( config: WordleConfig ) => maxPenalty( config ) + 1;

/**
 * What a seat scores: a large amount per word solved, less what it spent
 * getting there — `wordLength` per guess of its allowance, plus one per distinct
 * letter it actually typed.
 *
 * A guess is priced at `wordLength` letters because that is the most new
 * alphabet one can introduce, which puts the two penalties on the same scale
 * without a tuned weight.
 *
 * The two terms read different counts on purpose. Guesses are charged through
 * `guessesSpentBy`, so a forfeit gives up the rest of the allowance; letters are
 * counted off the guesses really played, since a forfeited guess burns no
 * alphabet. `guessesSpentBy` is still capped at the allowance either way, which
 * is what keeps the penalty inside `maxPenalty`.
 *
 * A seat that solved nothing scores zero rather than its penalty. Otherwise
 * every guess would carry strictly negative value, and on a board no one cracks
 * the player who refused to guess at all would win — flooring it makes playing
 * a free roll, and costs nothing, since solving even one word already clears
 * any penalty.
 *
 * @param state - The current state.
 * @param config - The table's config.
 * @param playerId - The seat to score.
 * @returns That seat's score, never negative.
 */
export const scoreFor = (
	state: WordleState,
	config: WordleConfig,
	playerId: PlayerId
) => {
	const solved = solvedCountFor( state, playerId );
	if ( solved === 0 ) {
		return 0;
	}

	return solvePoints( config ) * solved
		- config.wordLength * guessesSpentBy( state, config, playerId )
		- lettersUsed( guessesOf( state, playerId ) );
};


// --- View projection ---------------------------------------------------

/**
 * One seat's board, as some audience is allowed to read it.
 *
 * The rows are scored here rather than read back, since `computeRow` is pure in
 * the guess and the word and both are in `state`. A column runs to the guess
 * that solved its word and stops there; it is never padded out to the
 * allowance, because a filler row would sit at an index a real guess already
 * owns and mislabel every row past the solve. So `results[ w ][ i ]` is always
 * the row for `guesses[ i ]`, and a short column is what tells a client the word
 * is done.
 *
 * A seat the audience may not read is published as tallies alone — `guesses`
 * and `results` empty, `guessCount` carrying the size. Publishing a rival's rows
 * would leak, because every seat races the *same* words: a rival column going
 * all-`correct` names the guess that solved it, and its rows against the words
 * you have left are then free scored probes of a word you know.
 *
 * @param data - The current read-only snapshot.
 * @param playerId - The seat to build a board for.
 * @param audience - The audience accessing this board
 * @returns The board for that seat.
 */
export const boardFor = (
	{ state, config }: GameData<WordleState, WordleConfig>,
	playerId: PlayerId,
	audience: Audience
) => {
	const guesses = guessesOf( state, playerId );
	const open = state.decided || playerId === playerIdFor( audience );
	return Board.make( {
		playerId,
		guessCount: guesses.length,
		solvedWords: solvedWordsFor( state, playerId ),
		lettersUsed: lettersUsed( guesses ),
		finished: hasFinished( state, config, playerId ),
		score: scoreFor( state, config, playerId ),
		guesses: open ? guesses : [],
		results: open ? resultsFor( state, playerId ) : []
	} );
};
