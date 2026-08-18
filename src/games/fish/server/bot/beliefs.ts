import { asksOf, possibleHolders } from "@/games/fish/server/utils.ts";
import { getBookForCard } from "@/games/fish/shared/utils.ts";

import type { Book, FishConfig } from "@/games/fish/shared/schema.ts";
import type { PublicKnowledge } from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

// --- The belief model -------------------------------------------------------
// Everything one player believes about who holds what, derived once from the
// public table plus whatever that player privately knows. Three passes: candidate
// sets (A), exact deduction to fixpoint (B), then probabilities for whatever is
// left (C).
//
// Pass B must stay SOUND — the policy claims books on the strength of `owner`,
// and a wrong claim hands the book to the opposing team. Anything short of a
// proof belongs in `prob`, not in `owner`.
//
// The model is built from a *perspective* rather than always from the bot's own
// seat, because "how dangerous is it to hand this opponent the turn" is a
// question about what THEY can work out, not about what we can.

/**
 * How much more likely a player is to hold a book's remaining cards once they
 * have asked in that book. The only tuned number in the model, and it only ever
 * tilts ask targeting — `owner` (which authorises claims) is never touched by it.
 */
const BOOK_EVIDENCE_PRIOR = 3;

/**
 * When the fitting is finished: the point at which both margins hold at once —
 * every card has one holder, and every player holds exactly as many unseen cards
 * as they are known to. Iterating to a tolerance rather than a fixed count is
 * what keeps the column margin true rather than merely close, which a final row
 * pass would otherwise leave drifting.
 */
const FITTING_TOLERANCE = 1e-9;

/** A safety net on the fitting; it converges long before this in practice. */
const MAX_FITTING_ROUNDS = 128;

/** A safety net on the deduction fixpoint; it converges far sooner in practice. */
const MAX_DEDUCTION_PASSES = 64;

/**
 * Whose knowledge a model is being built from.
 *
 * - playerId: The seat whose view of the table this is
 * - hand: The cards that seat is known to hold
 * - complete: Whether `hand` is all of them. True only for the seat being played,
 * 		which sees its own cards; for anyone else it is a lower bound — the cards
 * 		*we* have proved are theirs, all of which they can see for themselves
 *
 * Omitted entirely, the model is the table's: what every seat, and a spectator,
 * can work out from the asks and the declarations alone.
 */
export type Perspective = {
	readonly playerId: PlayerId;
	readonly hand: readonly CardId[];
	readonly complete: boolean;
};

export type Beliefs = {
	/** The seat this was built from, or `undefined` for the table's own model. */
	readonly self: PlayerId | undefined;
	/** Books with at least one card still in play. */
	readonly liveBooks: readonly Book[];
	/** Cards still in play, grouped by book. */
	readonly cardsOf: ReadonlyMap<Book, readonly CardId[]>;
	/** Cards whose holder is *proven*, this perspective's own cards included. */
	readonly owner: ReadonlyMap<CardId, PlayerId>;
	/** P( player holds card ) for every card still unproven. Each row sums to 1. */
	readonly prob: ReadonlyMap<CardId, ReadonlyMap<PlayerId, number>>;
	/** How many still-unproven cards each player holds. The fitting's column margin. */
	readonly slots: ReadonlyMap<PlayerId, number>;
	/** Players who must still hold a card of a book, by the ask-in-book rule. */
	readonly bookAskers: ReadonlyMap<Book, ReadonlySet<PlayerId>>;
};

/** P( `player` holds `card` ) — 1 or 0 once the card is proven. */
export function probability( beliefs: Beliefs, card: CardId, player: PlayerId ) {
	const proven = beliefs.owner.get( card );
	if ( proven !== undefined ) {
		return proven === player ? 1 : 0;
	}

	return beliefs.prob.get( card )?.get( player ) ?? 0;
}

/**
 * P( `player` holds at least one card of `book` ) — which is what says whether
 * they may legally ask in it.
 *
 * The cards of a book are *not* independent, so `1 - ∏( 1 - p )` is wrong here:
 * a hand holds a fixed number of cards, so holding one of a book makes holding
 * another less likely, and treating them as independent understates how often a
 * player is in a book at all. The fitting already gives every card a marginal
 * under exactly that constraint, so this reads the answer off the same model:
 * the player's holdings are Bernoulli draws conditioned on their total coming to
 * the number of cards they actually hold, and
 *
 *     P( none of S | total = k ) = P( |S| = 0 ) × P( |rest| = k ) / P( |all| = k )
 *
 * each factor being a Poisson-binomial evaluated by the usual convolution. It
 * falls back to the independent form when the conditioning probability underflows,
 * which only happens once a hand is nearly pinned down and the two agree anyway.
 *
 * @param beliefs - The belief model.
 * @param book - The book being tested.
 * @param player - The player being tested.
 * @returns The probability they hold at least one of its cards.
 */
export function holdsBookProbability( beliefs: Beliefs, book: Book, player: PlayerId ) {
	const cards = beliefs.cardsOf.get( book ) ?? [];
	if ( cards.some( card => beliefs.owner.get( card ) === player ) ) {
		return 1;
	}

	const slots = beliefs.slots.get( player ) ?? 0;
	if ( slots <= 0 ) {
		return 0;
	}

	const inBook: Array<number> = [];
	const outside: Array<number> = [];

	for ( const [ card, row ] of beliefs.prob ) {
		const chance = row.get( player ) ?? 0;
		if ( cards.includes( card ) ) {
			inBook.push( chance );
		} else {
			outside.push( chance );
		}
	}

	const independent = 1 - inBook.reduce( ( none, chance ) => none * ( 1 - chance ), 1 );

	const within = poissonBinomial( inBook );
	const beyond = poissonBinomial( outside );

	let total = 0;
	for ( let held = 0; held <= slots && held < within.length; held++ ) {
		total = total + within[ held ]! * ( beyond[ slots - held ] ?? 0 );
	}

	if ( total <= FITTING_TOLERANCE ) {
		return independent;
	}

	const none = ( within[ 0 ] ?? 0 ) * ( beyond[ slots ] ?? 0 ) / total;
	return 1 - none;
}

/**
 * The distribution of how many of a set of independent draws come off.
 *
 * @param chances - One probability per draw.
 * @returns `pmf[ k ]` = P( exactly k of them hold ).
 */
function poissonBinomial( chances: readonly number[] ) {
	let pmf = [ 1 ];

	for ( const chance of chances ) {
		const next = new Array<number>( pmf.length + 1 ).fill( 0 );
		for ( let held = 0; held < pmf.length; held++ ) {
			next[ held ] = next[ held ]! + pmf[ held ]! * ( 1 - chance );
			next[ held + 1 ] = next[ held + 1 ]! + pmf[ held ]! * chance;
		}

		pmf = next;
	}

	return pmf;
}

/**
 * Build a belief model from one perspective.
 *
 * @param known - The table's public knowledge: the counts and the three histories.
 * @param config - Game config, for the book variant and the books in play.
 * @param perspective - Whose knowledge to build from. Omit for the table's own.
 * @returns The belief model every decision reads.
 * @public
 */
export function buildBeliefs(
	known: PublicKnowledge,
	config: FishConfig,
	perspective?: Perspective
) {
	// Where the cards could be, by the table's own reckoning. A perspective only
	// ever narrows this: the cards it holds are settled, and it is ruled out of the
	// rest when it can see its whole hand.
	const holders = possibleHolders( known, config.books );

	const cardsOf = new Map<Book, CardId[]>();
	for ( const card of holders.keys() ) {
		const book = getBookForCard( card, config.type );
		if ( !book ) {
			continue;
		}

		if ( !cardsOf.has( book ) ) {
			cardsOf.set( book, [] );
		}

		cardsOf.get( book )!.push( card );
	}

	const liveBooks = Array.from( cardsOf.keys() );
	const bookAskers = collectBookAskers( known, config, cardsOf );

	// --- Pass A: candidate sets ---------------------------------------------
	// A card this perspective holds is settled. For every other card anyone out of
	// cards is ruled out, as is the perspective itself when its hand is complete —
	// it provably does not hold what it cannot see in its own hand.
	const self = perspective?.playerId;
	const own = new Set( perspective?.hand ?? [] );

	const owner = new Map<CardId, PlayerId>();
	const candidates = new Map<CardId, Set<PlayerId>>();

	for ( const [ card, possible ] of holders ) {
		if ( self !== undefined && own.has( card ) ) {
			owner.set( card, self );
			continue;
		}

		candidates.set( card, new Set(
			possible.filter( pid =>
				!( perspective?.complete === true && pid === self )
				&& ( known.cardCounts[ pid ] ?? 0 ) > 0
			)
		) );
	}

	// What each player holds that this perspective has not already accounted for.
	// A complete perspective has none of its own left over by definition — it can
	// see its whole hand — and saying so keeps the fitting's column margin
	// answerable even if the counts and the hand it was handed disagree.
	const slots = new Map<PlayerId, number>();
	for ( const [ pid, count ] of Object.entries( known.cardCounts ) as [ PlayerId, number ][] ) {
		if ( pid === self && perspective?.complete === true ) {
			continue;
		}

		const free = pid === self ? count - own.size : count;
		if ( free > 0 ) {
			slots.set( pid, free );
		}
	}

	deduce( candidates, owner, slots, cardsOf, bookAskers );

	// --- Pass C: probabilities for whatever survived deduction ---------------
	const prob = fitProbabilities( candidates, slots, bookAskers, config );

	return { self, liveBooks, cardsOf, owner, prob, slots, bookAskers };
}

/**
 * Players who must still hold a card of a live book, by the rule that you may
 * only ask in a book you hold a card of (`askCard.validate`).
 *
 * Kept sound: a card can only leave a hand by being asked away or by the book
 * being claimed. So the constraint is dropped if anyone has since taken a card
 * of that book off the asker — they may have given up their last one.
 */
function collectBookAskers(
	known: PublicKnowledge,
	config: FishConfig,
	cardsOf: ReadonlyMap<Book, readonly CardId[]>
) {
	const askers = new Map<Book, Set<PlayerId>>();

	// The history is oldest-first, so a later ask has the higher index — and the
	// tighter window, since less can have happened since.
	const asks = asksOf( known ).map( ( ask, index ) => ( {
		...ask,
		index,
		book: getBookForCard( ask.cardId, config.type )
	} ) );

	for ( const ask of asks ) {
		if ( !ask.book || !cardsOf.has( ask.book ) ) {
			continue;
		}

		if ( ( known.cardCounts[ ask.playerId ] ?? 0 ) <= 0 ) {
			continue;
		}

		const stolenSince = asks.some(
			other => other.index > ask.index
				&& other.success
				&& other.from === ask.playerId
				&& other.book === ask.book
		);

		if ( stolenSince ) {
			continue;
		}

		if ( !askers.has( ask.book ) ) {
			askers.set( ask.book, new Set() );
		}

		askers.get( ask.book )!.add( ask.playerId );
	}

	return askers;
}

/**
 * Pass B — exact deduction, to fixpoint. Every rule here is a proof, never a
 * guess: a lone candidate, a player whose remaining cards are all accounted
 * for, a player out of room, or a book whose owner-must-hold-one constraint has
 * exactly one card left to satisfy it.
 */
function deduce(
	candidates: Map<CardId, Set<PlayerId>>,
	owner: Map<CardId, PlayerId>,
	slots: Map<PlayerId, number>,
	cardsOf: ReadonlyMap<Book, readonly CardId[]>,
	bookAskers: ReadonlyMap<Book, ReadonlySet<PlayerId>>
) {
	const assign = ( card: CardId, pid: PlayerId ) => {
		owner.set( card, pid );
		candidates.delete( card );
		slots.set( pid, ( slots.get( pid ) ?? 0 ) - 1 );
	};

	for ( let pass = 0; pass < MAX_DEDUCTION_PASSES; pass++ ) {
		let changed = false;

		// A card with a single candidate is theirs.
		for ( const [ card, possible ] of candidates ) {
			if ( possible.size === 1 ) {
				assign( card, [ ...possible ][ 0 ]! );
				changed = true;
			}
		}

		// Someone out of room cannot be holding anything else.
		for ( const [ pid, free ] of slots ) {
			if ( free > 0 ) {
				continue;
			}

			for ( const possible of candidates.values() ) {
				if ( possible.delete( pid ) ) {
					changed = true;
				}
			}
		}

		// Someone whose remaining cards are exactly the cards still listing them
		// holds all of them.
		for ( const [ pid, free ] of slots ) {
			if ( free <= 0 ) {
				continue;
			}

			const listing = [ ...candidates ]
				.filter( ( [ , possible ] ) => possible.has( pid ) )
				.map( ( [ card ] ) => card );

			if ( listing.length === free ) {
				for ( const card of listing ) {
					assign( card, pid );
				}

				changed = true;
			}
		}

		// A player who must hold a card of a book, with only one candidate card
		// of that book left to satisfy it, holds that card. This is the whole of
		// the old signalling convention — arriving as a proof instead of a hunch.
		for ( const [ book, askers ] of bookAskers ) {
			for ( const pid of askers ) {
				const cards = cardsOf.get( book ) ?? [];
				const settled = cards.some( card => owner.get( card ) === pid );
				if ( settled ) {
					continue;
				}

				const witnesses = cards.filter( card => candidates.get( card )?.has( pid ) );
				if ( witnesses.length === 1 ) {
					assign( witnesses[ 0 ]!, pid );
					changed = true;
				}
			}
		}

		if ( !changed ) {
			return;
		}
	}
}

/**
 * Pass C — iterative proportional fitting against the two exact margins: every
 * card has exactly one holder, and every player holds exactly `slots[ p ]` of the
 * cards this perspective cannot place. Hand sizes are what make this sharper than
 * splitting evenly across candidates.
 *
 * It runs until both margins hold together rather than for a set number of
 * rounds, so the rows are true probabilities *and* the columns still add up to
 * the hands they describe — the conditional correction in `holdsBookProbability`
 * reads the columns, and a drifting one would quietly bias it.
 */
function fitProbabilities(
	candidates: ReadonlyMap<CardId, ReadonlySet<PlayerId>>,
	slots: ReadonlyMap<PlayerId, number>,
	bookAskers: ReadonlyMap<Book, ReadonlySet<PlayerId>>,
	config: FishConfig
) {
	const prob = new Map<CardId, Map<PlayerId, number>>();
	const players = [ ...slots.keys() ].filter( pid => ( slots.get( pid ) ?? 0 ) > 0 );

	for ( const [ card, possible ] of candidates ) {
		const row = new Map<PlayerId, number>();
		const book = getBookForCard( card, config.type );
		const askers = book ? bookAskers.get( book ) : undefined;

		for ( const pid of players ) {
			if ( !possible.has( pid ) ) {
				continue;
			}

			row.set( pid, askers?.has( pid ) ? BOOK_EVIDENCE_PRIOR : 1 );
		}

		prob.set( card, row );
	}

	for ( let round = 0; round < MAX_FITTING_ROUNDS; round++ ) {
		normaliseRows( prob );

		if ( fitColumns( prob, players, slots ) < FITTING_TOLERANCE ) {
			break;
		}
	}

	normaliseRows( prob );

	return prob;
}

/**
 * Scales each player's column onto the number of cards they hold.
 *
 * @returns How far the columns were off before scaling — the convergence test.
 */
function fitColumns(
	prob: ReadonlyMap<CardId, Map<PlayerId, number>>,
	players: readonly PlayerId[],
	slots: ReadonlyMap<PlayerId, number>
) {
	let drift = 0;

	for ( const pid of players ) {
		let total = 0;
		for ( const row of prob.values() ) {
			total = total + ( row.get( pid ) ?? 0 );
		}

		const held = slots.get( pid ) ?? 0;
		drift = Math.max( drift, Math.abs( total - held ) );

		if ( total <= 0 ) {
			continue;
		}

		const scale = held / total;
		for ( const row of prob.values() ) {
			const value = row.get( pid );
			if ( value !== undefined ) {
				row.set( pid, value * scale );
			}
		}
	}

	return drift;
}

function normaliseRows( prob: ReadonlyMap<CardId, Map<PlayerId, number>> ) {
	for ( const row of prob.values() ) {
		let total = 0;
		for ( const value of row.values() ) {
			total = total + value;
		}

		if ( total <= 0 ) {
			continue;
		}

		for ( const [ pid, value ] of row ) {
			row.set( pid, value / total );
		}
	}
}
