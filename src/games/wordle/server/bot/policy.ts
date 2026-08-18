import { candidatesFor } from "@/games/wordle/server/bot/candidates.ts";
import { computeRow } from "@/games/wordle/server/utils.ts";
import { dictionaries } from "@/games/wordle/shared/dictionary.ts";

import type {
	GuessRow,
	LetterStatus,
	WordleBotData,
	WordleConfig,
	WordLength,
	WordleView
} from "@/games/wordle/shared/schema.ts";
import type { GameData } from "@/swish/shared/schema.ts";

// --- The policy ------------------------------------------------------------
// A guess is chosen in two steps: pick the word to chase — the unsolved one with
// the fewest answers left, which is the one closest to a certain solve — then
// pick the guess expected to leave the least standing across the board as a
// whole, so a guess aimed at one word is still narrowing the rest.
//
// Two rules fall out of how the table scores, and both are worth knowing before
// reading the rest:
//
// The bot guesses words that could be answers, right up until brute force stops
// working. Solving a word is worth more than the largest penalty a seat can
// accrue (`solvePoints`), while a guess costs `wordLength` plus whatever
// alphabet it burns — so while there is time to work a word down one answer at a
// time, a guess that cannot solve anything is a certain cost against a payoff it
// can only collect second-hand. What flips that is running out of room: seven
// answers left and three guesses to spend cannot be brute-forced, and a word
// that merely tells them apart turns a long shot into a certainty. `probing` is
// exactly that boundary, and nothing below it reaches for a probe.
//
// The bot never forfeits. Forfeiting charges the whole remaining allowance
// rather than banking it (`guessesSpentBy`), so it is strictly worse than
// playing the allowance out: guessing on costs a fraction of the same penalty
// and might still solve a word. There is no board on which giving up scores
// better, so the move exists for people who want their evening back, not for a
// policy.

/**
 * How many candidates get scored properly. Scoring is quadratic in the pool, and
 * an opening move sees the entire dictionary — so the pool is cut to this by a
 * cheap coverage ranking first, and only the survivors are measured.
 */
const POOL_CAP = 48;

/**
 * How many possible answers a guess is measured against per hidden word. Taken
 * evenly across the candidate set rather than off the front, so the sample keeps
 * the set's spread of letters instead of a slice of the alphabet.
 */
const EVAL_CAP = 128;

/** A row packed into a single integer, so partitioning is a numeric key. */
const STATUS_CODES: Record<LetterStatus, number> = { absent: 0, present: 1, correct: 2 };

/**
 * Packs a scored row into the integer that identifies its bucket. Three statuses
 * per position and at most six positions, so it always fits.
 *
 * @param row - The scored row.
 * @returns A key equal for identical rows and different for any other.
 */
const encodeRow = ( row: GuessRow ) =>
	row.reduce( ( code, status ) => code * 3 + STATUS_CODES[ status ], 0 );

/**
 * Thins a list to at most `limit` entries, taken at an even stride.
 *
 * @param words - The words to thin.
 * @param limit - The most entries to keep.
 * @returns The sample, or the list itself when it is already small enough.
 */
const sample = ( words: ReadonlyArray<string>, limit: number ) => {
	if ( words.length <= limit ) {
		return words;
	}

	const stride = Math.ceil( words.length / limit );
	const taken: string[] = [];
	for ( let i = 0; i < words.length; i += stride ) {
		taken.push( words[ i ]! );
	}

	return taken;
};

/**
 * The most informative-looking candidates, by a measure cheap enough to run over
 * the whole dictionary: a word scores the popularity of each *distinct* letter
 * it carries, summed. Repeating a letter earns nothing, which is what favours
 * words that touch five different common letters over ones that spend two
 * positions on the same one.
 *
 * This only ever picks which candidates are worth measuring properly — the
 * choice itself is made by `expectedFraction`.
 *
 * @param pool - The candidates to rank.
 * @param limit - How many to keep.
 * @returns The top-ranked candidates, ties broken alphabetically.
 */
const byCoverage = ( pool: ReadonlyArray<string>, limit: number ) => {
	if ( pool.length <= limit ) {
		return pool;
	}

	const popularity: Record<string, number> = {};
	for ( const word of pool ) {
		for ( const letter of new Set( word ) ) {
			popularity[ letter ] = ( popularity[ letter ] ?? 0 ) + 1;
		}
	}

	const coverage = new Map(
		pool.map( word => [
			word,
			[ ...new Set( word ) ].reduce( ( sum, letter ) => sum + ( popularity[ letter ] ?? 0 ), 0 )
		] )
	);

	return [ ...pool ]
		.sort( ( a, b ) => ( coverage.get( b ) ?? 0 ) - ( coverage.get( a ) ?? 0 ) || a.localeCompare( b ) )
		.slice( 0, limit );
};

/**
 * What fraction of a candidate set a guess is expected to leave standing —
 * `1 / n · Σ (bucket size) · (bucket size) / n` over the rows the guess would
 * score against each of them. A guess that tells every candidate apart scores
 * `1 / n`; one that scores the same row against all of them scores `1`.
 *
 * Expected *fraction* rather than count so that every hidden word weighs the
 * same in the sum, whatever stage each of them is at — otherwise the word with
 * the widest candidate set would decide every guess on its own.
 *
 * @param guess - The candidate being measured.
 * @param pool - The answers still possible at one hidden word.
 * @returns The expected share of that pool left after guessing, in `(0, 1]`.
 */
const expectedFraction = ( guess: string, pool: ReadonlyArray<string> ) => {
	if ( pool.length === 0 ) {
		return 0;
	}

	const buckets = new Map<number, number>();
	for ( const word of pool ) {
		const key = encodeRow( computeRow( guess, word ) );
		buckets.set( key, ( buckets.get( key ) ?? 0 ) + 1 );
	}

	let weighted = 0;
	for ( const size of buckets.values() ) {
		weighted += size * size;
	}

	return weighted / ( pool.length * pool.length );
};

/**
 * How much fresh alphabet a guess would spend. The table charges one point per
 * distinct letter a seat has typed, so this is the guess's real cost — the
 * letters already spent are paid for and free to reuse.
 *
 * Only ever a tie-break: information is worth more than a point, and a solve is
 * worth more than the whole penalty.
 *
 * @param guess - The candidate being priced.
 * @param played - The guesses already played.
 * @returns The number of letters this guess would add to the tally.
 */
const newLetters = ( guess: string, played: ReadonlyArray<string> ) => {
	const spent = new Set( played.flatMap( word => [ ...word ] ) );
	return [ ...new Set( guess ) ].filter( letter => !spent.has( letter ) ).length;
};

/**
 * The words worth playing purely to be told apart by. Ranked by how much of the
 * *disagreement* between the candidates a word touches: a letter half of them
 * carry splits the set down the middle, a letter all of them carry or none of
 * them carry splits nothing, and `min( carrying, missing )` is exactly that
 * measure. Summed over a word's distinct letters, it is what a probe is for.
 *
 * Nothing here can win the word it is aimed at — a probe is only reached for
 * when guessing the answers one by one can no longer guarantee it in the time
 * left, and then a certain split beats a long shot.
 *
 * @param candidates - The answers the probe has to tell apart.
 * @param played - The guesses already played, which are no longer legal.
 * @param wordLength - The length this table plays at.
 * @param limit - How many probes to keep.
 * @returns The top-ranked probes, ties broken alphabetically.
 */
const byDiscrimination = (
	candidates: ReadonlyArray<string>,
	played: ReadonlyArray<string>,
	wordLength: WordLength,
	limit: number
) => {
	const carrying: Record<string, number> = {};
	for ( const word of candidates ) {
		for ( const letter of new Set( word ) ) {
			carrying[ letter ] = ( carrying[ letter ] ?? 0 ) + 1;
		}
	}

	const split = ( letter: string ) => {
		const held = carrying[ letter ] ?? 0;
		return Math.min( held, candidates.length - held );
	};

	const pool = dictionaries[ wordLength ].filter( word => !played.includes( word ) );
	const power = new Map(
		pool.map( word => [
			word,
			[ ...new Set( word ) ].reduce( ( sum, letter ) => sum + split( letter ), 0 )
		] )
	);

	return [ ...pool ]
		.sort( ( x, y ) => ( power.get( y ) ?? 0 ) - ( power.get( x ) ?? 0 ) || x.localeCompare( y ) )
		.slice( 0, limit );
};

/**
 * Whether the view the engine handed over belongs to a seat rather than to the
 * table. It always does — a seat is only ever played through its own audience —
 * and this is what narrows the one wire view to the shape holding a board the
 * policy may read.
 */
const isSeated = ( data: GameData<WordleView, WordleConfig> ): data is WordleBotData =>
	data.state.playerId !== undefined;

/**
 * Picks the bot's guess.
 *
 * The word chased is whichever unsolved one has the fewest answers left: it is
 * the closest to a certain solve, and a solve outranks every efficiency
 * consideration on the board. Its candidates are the pool — joined by words that
 * can only tell them apart once there is no longer room to try them one by one —
 * and the guess chosen is the one expected to leave the least standing across
 * *all* the unsolved words, so a guess aimed at one board is still doing the
 * narrowing work on the rest.
 *
 * @param data - The acting seat's data, its own audience.
 * @returns The guess to submit, or `undefined` when the seat has nothing to play.
 * @public
 */
export function decideWordleMove( data: GameData<WordleView, WordleConfig> ) {
	if ( !isSeated( data ) ) {
		return undefined;
	}

	const board = data.state.boards.find( seat => seat.playerId === data.state.playerId );

	// A finished seat has no move, and neither does a board this view was not
	// entitled to read. The engine never schedules either, but the policy is the
	// wrong place to find that out the hard way.
	if ( !board || board.finished ) {
		return undefined;
	}

	const { wordLength } = data.config;

	const unsolved = board.solvedWords
		.map( ( solved, index ) => ( { index, solved } ) )
		.filter( entry => !entry.solved )
		.map( entry => candidatesFor( board, wordLength, entry.index ) )
		.filter( candidates => candidates.length > 0 );

	// Nothing narrows a word whose answers have all been ruled out, which can only
	// mean the board disagrees with the dictionary it was drawn from. Guess a word
	// that has not been played rather than stalling the seat, which — holding the
	// turn as it does — would stall the table with it.
	const fallback = dictionaries[ wordLength ].filter( word => !board.guesses.includes( word ) );
	const target = unsolved.reduce<ReadonlyArray<string>>(
		( fewest, candidates ) => candidates.length < fewest.length ? candidates : fewest,
		unsolved[ 0 ] ?? fallback
	);

	// Guesses beyond the one each unsolved word must have to itself. Working the
	// target down one answer at a time takes `slack + 1` guesses in the worst
	// case; needing more than that is what makes a probe worth its guess, and
	// having no slack at all is what makes the long shot the only play.
	const slack = data.state.maxGuesses - board.guessCount - unsolved.length;
	const probing = slack > 0 && target.length > slack + 1;

	const pool = [
		...byCoverage( target, POOL_CAP ),
		...probing ? byDiscrimination( target, board.guesses, wordLength, POOL_CAP ) : []
	];

	if ( pool.length === 0 ) {
		return undefined;
	}

	const answers = new Set( unsolved.flat() );
	const measured = unsolved.map( candidates => sample( candidates, EVAL_CAP ) );

	const scored = pool.map( guess => ( {
		guess,
		spread: measured.reduce( ( sum, left ) => sum + expectedFraction( guess, left ), 0 ),
		solves: answers.has( guess ),
		cost: newLetters( guess, board.guesses )
	} ) );

	// Least left standing first. A word that could be an answer breaks the tie —
	// it is the same information and a chance to end a board with it — and the
	// alphabet it would burn breaks what that leaves, since the table charges for
	// every distinct letter typed.
	const best = scored.reduce( ( chosen, option ) => {
		const better = option.spread !== chosen.spread
			? option.spread < chosen.spread
			: option.solves !== chosen.solves
				? option.solves
				: option.cost !== chosen.cost
					? option.cost < chosen.cost
					: option.guess.localeCompare( chosen.guess ) < 0;

		return better ? option : chosen;
	} );

	return { moveType: "guess" as const, input: { guess: best.guess } };
}
