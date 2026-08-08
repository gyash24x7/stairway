import type { Book, FishConfig, FishPlayerView } from "@/games/fish/shared/schema.ts";
import { getBookForCard } from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";

// --- The belief model -------------------------------------------------------
// Everything the bot believes about who holds what, derived once per turn from
// the public view plus its own hand. Three passes: candidate sets (A), exact
// deduction to fixpoint (B), then probabilities for whatever is left (C).
//
// Pass B must stay SOUND — the policy claims books on the strength of `owner`,
// and a wrong claim hands the book to the opposing team. Anything short of a
// proof belongs in `prob`, not in `owner`.

/**
 * How much more likely a player is to hold a book's remaining cards once they
 * have asked in that book. The only tuned number in the model, and it only ever
 * tilts ask targeting — `owner` (which authorises claims) is never touched by it.
 */
const BOOK_EVIDENCE_PRIOR = 3;

/** Iterative proportional fitting rounds. Fixed, so the model is deterministic. */
const FITTING_ROUNDS = 32;

/** A safety net on the deduction fixpoint; it converges far sooner in practice. */
const MAX_DEDUCTION_PASSES = 64;

export type Beliefs = {
	/** The bot whose view this was built from. */
	readonly self: PlayerId;
	/** Books with at least one card still in play. */
	readonly liveBooks: readonly Book[];
	/** Cards still in play, grouped by book. */
	readonly cardsOf: ReadonlyMap<Book, readonly CardId[]>;
	/** Cards whose holder is *proven*, the bot's own hand included. */
	readonly owner: ReadonlyMap<CardId, PlayerId>;
	/** P( player holds card ) for every card still unproven. Each row sums to 1. */
	readonly prob: ReadonlyMap<CardId, ReadonlyMap<PlayerId, number>>;
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

/** P( `player` holds at least one card of `book` ), treating the cards as independent. */
export function holdsBookProbability( beliefs: Beliefs, book: Book, player: PlayerId ) {
	const cards = beliefs.cardsOf.get( book ) ?? [];
	let none = 1;
	for ( const card of cards ) {
		none *= ( 1 - probability( beliefs, card, player ) );
	}

	return 1 - none;
}

/**
 * Build the bot's beliefs from its own player view.
 *
 * @param view - The acting bot's view: public state plus its private hand.
 * @param config - Game config, for the book variant.
 * @returns The belief model every decision reads.
 * @public
 */
export function buildBeliefs( view: FishPlayerView, config: FishConfig ) {
	const self = view.playerId;
	const liveCards = Object.keys( view.cardLocations ) as CardId[];

	const cardsOf = new Map<Book, CardId[]>();
	for ( const card of liveCards ) {
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
	const bookAskers = collectBookAskers( view, config, cardsOf );

	// --- Pass A: candidate sets ---------------------------------------------
	// A card in hand is settled. For every other card the bot itself is ruled
	// out — it provably does not hold it — as is anyone out of cards.
	const owner = new Map<CardId, PlayerId>();
	const candidates = new Map<CardId, Set<PlayerId>>();

	for ( const card of liveCards ) {
		if ( view.hand.includes( card ) ) {
			owner.set( card, self );
			continue;
		}

		const possible = ( view.cardLocations[ card ] ?? [] ).filter(
			pid => pid !== self && ( view.cardCounts[ pid ] ?? 0 ) > 0
		);
		candidates.set( card, new Set( possible ) );
	}

	const slots = new Map<PlayerId, number>();
	for ( const [ pid, count ] of Object.entries( view.cardCounts ) as [ PlayerId, number ][] ) {
		if ( pid !== self && count > 0 ) {
			slots.set( pid, count );
		}
	}

	deduce( candidates, owner, slots, cardsOf, bookAskers );

	// --- Pass C: probabilities for whatever survived deduction ---------------
	const prob = fitProbabilities( candidates, slots, bookAskers, config );

	return { self, liveBooks, cardsOf, owner, prob, bookAskers };
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
	view: FishPlayerView,
	config: FishConfig,
	cardsOf: ReadonlyMap<Book, readonly CardId[]>
) {
	const askers = new Map<Book, Set<PlayerId>>();
	// `askHistory` is newest-first, so a lower index is a later ask.
	const asks = view.askHistory.map( ( ask, index ) => ( {
		...ask,
		index,
		book: getBookForCard( ask.cardId, config.type )
	} ) );

	for ( const ask of asks ) {
		if ( !ask.book || !cardsOf.has( ask.book ) ) {
			continue;
		}

		if ( ( view.cardCounts[ ask.playerId ] ?? 0 ) <= 0 ) {
			continue;
		}

		if ( askers.get( ask.book )?.has( ask.playerId ) ) {
			// Already recorded from a more recent ask, which has a tighter window.
			continue;
		}

		const stolenSince = asks.some(
			other => other.index < ask.index
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
 * card has exactly one holder, and every player holds exactly `cardCounts[p]`
 * of the cards the bot cannot see. Hand sizes are what make this sharper than
 * splitting evenly across candidates.
 */
function fitProbabilities(
	candidates: ReadonlyMap<CardId, ReadonlySet<PlayerId>>,
	slots: ReadonlyMap<PlayerId, number>,
	bookAskers: ReadonlyMap<Book, ReadonlySet<PlayerId>>,
	config: FishConfig
) {
	const prob = new Map<CardId, Map<PlayerId, number>>();
	const cards = [ ...candidates.keys() ];
	const players = [ ...slots.keys() ].filter( pid => ( slots.get( pid ) ?? 0 ) > 0 );

	for ( const card of cards ) {
		const row = new Map<PlayerId, number>();
		const book = getBookForCard( card, config.type );
		const askers = book ? bookAskers.get( book ) : undefined;

		for ( const pid of players ) {
			if ( !candidates.get( card )!.has( pid ) ) {
				continue;
			}

			row.set( pid, askers?.has( pid ) ? BOOK_EVIDENCE_PRIOR : 1 );
		}

		prob.set( card, row );
	}

	for ( let round = 0; round < FITTING_ROUNDS; round++ ) {
		normaliseRows( prob );

		// Columns: a player's probabilities across all unseen cards must add up
		// to the number of cards they actually hold.
		for ( const pid of players ) {
			let total = 0;
			for ( const row of prob.values() ) {
				total += row.get( pid ) ?? 0;
			}

			if ( total <= 0 ) {
				continue;
			}

			const scale = ( slots.get( pid ) ?? 0 ) / total;
			for ( const row of prob.values() ) {
				const value = row.get( pid );
				if ( value !== undefined ) {
					row.set( pid, value * scale );
				}
			}
		}
	}

	// Finish on the row margin so the result reads as a probability per card.
	// Column sums drift slightly off `cardCounts` as a result; the ordering the
	// policy needs survives that, and rows staying true probabilities matters more.
	normaliseRows( prob );

	return prob;
}

function normaliseRows( prob: ReadonlyMap<CardId, Map<PlayerId, number>> ) {
	for ( const row of prob.values() ) {
		let total = 0;
		for ( const value of row.values() ) {
			total += value;
		}

		if ( total <= 0 ) {
			continue;
		}

		for ( const [ pid, value ] of row ) {
			row.set( pid, value / total );
		}
	}
}
