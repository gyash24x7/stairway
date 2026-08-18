import { computeRow } from "@/games/wordle/server/utils.ts";
import { dictionaries } from "@/games/wordle/shared/dictionary.ts";

import type { Board, GuessRow, WordLength } from "@/games/wordle/shared/schema.ts";

// --- Constraint filtering --------------------------------------------------
// Everything the bot knows about a hidden word is the rows that word has scored
// against the guesses already played. There is no cheaper representation of that
// knowledge than the rows themselves: a row is exactly `computeRow( guess, word )`,
// so a word is still possible precisely when it would have produced every row the
// board actually shows. Re-scoring the dictionary is what tests that, and it is
// right by construction — a hand-rolled summary of "these letters are present,
// these are absent, these positions are pinned" has to re-derive the
// doubled-letter rule `computeRow` already implements, and gets it subtly wrong.

/**
 * Whether two scored rows are the same, position by position.
 *
 * @param left - The first row.
 * @param right - The second row.
 * @returns `true` when both rows score identically.
 */
const sameRow = ( left: GuessRow, right: GuessRow ) =>
	left.length === right.length && left.every( ( status, i ) => status === right[ i ] );

/**
 * Whether a word could still be the answer a column was scored against — it is,
 * when playing every guess already played against it would have produced exactly
 * the rows the column holds.
 *
 * A word already guessed is ruled out for free: guessing it scores all-`correct`
 * against itself, which no unsolved column can hold.
 *
 * @param word - The dictionary word being tested.
 * @param guesses - The guesses played, in order.
 * @param column - The rows those guesses scored, index-aligned with them.
 * @returns `true` when the word is consistent with every row.
 */
export const isConsistent = (
	word: string,
	guesses: ReadonlyArray<string>,
	column: ReadonlyArray<GuessRow>
) => column.every( ( row, i ) => {
	const guess = guesses[ i ];
	return guess !== undefined && sameRow( computeRow( guess, word ), row );
} );

/**
 * Every word that could still be the answer at one of a board's hidden words.
 *
 * Read off the board rather than off state, since the board is all a seat — and
 * so all of its policy — is entitled to see. A solved word's column stops at the
 * guess that solved it, so this is only ever asked about the unsolved ones,
 * where the column runs the whole length of the guesses.
 *
 * @param board - The acting seat's own board, rows filled in.
 * @param wordLength - The length this table plays at.
 * @param wordIndex - Which of the hidden words to narrow.
 * @returns The words still consistent with that word's column.
 */
export const candidatesFor = (
	board: Board,
	wordLength: WordLength,
	wordIndex: number
) => {
	const column = board.results[ wordIndex ] ?? [];
	return dictionaries[ wordLength ].filter(
		word => isConsistent( word, board.guesses, column )
	);
};
