import { dictionaries } from "@/games/wordle/shared/dictionary.ts";

import type { WordLength } from "@/games/wordle/shared/schema.ts";

/**
 * The form a guess is compared, stored and replayed in. The dictionaries are
 * lowercase, so a client typing in caps must not be told its word is unknown.
 *
 * @param guess - The guess as the client sent it.
 * @returns The guess in dictionary form.
 */
export const normalizeGuess = ( guess: string ) => guess.trim().toLowerCase();

/**
 * The dictionaries as sets, so checking a guess is a lookup rather than a scan
 * of a few thousand words on every move. `dictionaries` is the source of truth:
 * every entry is lowercase and filed under its own length, and a word that
 * breaks either rule is a bug in the data — `setup` draws its answers from the
 * same lists, so a misfiled word would hide an answer no legal guess of that
 * length could ever match.
 */
const wordSets = new Map<WordLength, ReadonlySet<string>>(
	Object.entries( dictionaries ).map(
		( [ length, words ] ) => [ Number( length ) as WordLength, new Set( words ) ]
	)
);

/**
 * Whether a guess is a word the table would accept.
 *
 * Shared rather than server-only so the client can refuse an unknown word
 * without a round trip, against the very same list the engine validates with —
 * a client with its own copy of the rule is a client that eventually disagrees.
 * The server still checks: this is an affordance, not a gate.
 *
 * @param guess - The normalized guess.
 * @param wordLength - The length this table plays at.
 * @returns `true` when the dictionary holds the word.
 */
export const isValidWord = ( guess: string, wordLength: WordLength ) =>
	wordSets.get( wordLength )?.has( guess ) ?? false;
