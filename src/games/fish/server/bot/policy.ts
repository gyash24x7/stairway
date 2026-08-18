import { buildBeliefs, probability } from "@/games/fish/server/bot/beliefs.ts";
import {
	bestSnatch,
	opponentRisk,
	seatBeliefs,
	snatchScore
} from "@/games/fish/server/bot/snatch.ts";
import { asksOf } from "@/games/fish/server/utils.ts";
import {
	canTransferTurn,
	claimsOf,
	getBookForCard,
	getCardsOfBook,
	getTeamScores
} from "@/games/fish/shared/utils.ts";
import { teamMatesOf, teamOf } from "@/swish/shared/teams.ts";

import type { Beliefs } from "@/games/fish/server/bot/beliefs.ts";
import type { Snatch } from "@/games/fish/server/bot/snatch.ts";
import type {
	Book,
	FishBotData,
	FishConfig,
	FishSeatView,
	FishView
} from "@/games/fish/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { GameData, PlayerId } from "@/swish/shared/schema.ts";

// --- The policy -------------------------------------------------------------
// A flat priority list over the belief model. The one thing worth understanding
// before reading it: a successful claim is the ONLY way to hand the turn to a
// chosen teammate, so a book the team provably holds is not a point to bank —
// it is a stored turn-teleport. Nobody can take it off us (asking in a book
// requires holding one of its cards, and we hold them all), so we sit on it
// until a teammate is better placed to act, then cash it and pass them the turn.
//
// Every seat is modelled from its own knowledge, not from ours: what a teammate
// or an opponent can do with the turn depends on what they can see.

/**
 * How much better a teammate's prospects must be before the bot spends a banked
 * claim to hand them the turn. Hysteresis, so a marginal difference does not
 * burn the bank.
 */
const HOLD_MARGIN = 1.25;

/**
 * How much better an ask in another book has to be before the bot abandons the
 * one it is working. Asks are ranked on a single expectation now, and without
 * some stickiness a hair of difference would send it hopping between books —
 * which is exactly what made an earlier version impossible to follow at the table.
 */
const BOOK_SWITCH_MARGIN = 1.15;


/**
 * Whether this view was built for a seat rather than for the table. The engine
 * only ever plays a seat through that seat's own audience, so this holds every
 * time it is asked — it is what narrows the one wire view to the seated shape the
 * rest of the policy reads its hand from.
 */
const isSeated = ( data: GameData<FishView, FishConfig> ): data is FishBotData =>
	data.state.playerId !== undefined;

/**
 * Pick the bot's move.
 *
 * @param data - The acting bot's data, its own audience.
 * @returns The move to submit, or `undefined` when there is nothing legal left.
 * @public
 */
export function decideFishMove( data: GameData<FishView, FishConfig> ) {
	if ( !isSeated( data ) ) {
		return undefined;
	}

	const beliefs = buildBeliefs( data.state, data.config, {
		playerId: data.state.playerId,
		hand: data.state.hand,
		complete: true
	} );

	// One model per other seat, each from that seat's own knowledge. Everything
	// that asks "how well placed is somebody else" reads theirs, not ours.
	const seats = seatBeliefs( data, beliefs );

	// 1. Straight after our own successful claim, a transfer is the only legal
	//    move — and the whole point of having claimed. Hand it to whoever is best
	//    placed; card counts here are already post-claim.
	if ( canTransferTurn( data.state, data.context.currentPlayer ) ) {
		const target = bestTeammate( data, seats );
		if ( target ) {
			return { moveType: "transferTurn" as const, input: { transferTo: target } };
		}
	}

	const banked = bankedBooks( beliefs, data );
	const active = activeBook( data );

	// Whoever we ask gets the turn if we are wrong, so price that in first.
	const risks = opponentRisk( data, seats );
	const ask = stayOnBook(
		beliefs,
		data,
		active,
		bestSnatch( beliefs, data, data.state.playerId, undefined, risks ),
		risks
	);

	// 2. Spend a banked book, if this is the moment for it.
	const cashIn = chooseCashIn( beliefs, data, seats, banked, ask );
	if ( cashIn ) {
		return {
			moveType: "claimBook" as const,
			input: { claim: provenClaim( beliefs, cashIn ) }
		};
	}

	// 3. Otherwise keep working.
	if ( ask ) {
		return {
			moveType: "askCard" as const,
			input: { from: ask.from, cardId: ask.cardId }
		};
	}

	// 4. No ask and nothing banked: every card of every book we hold is already
	//    with our own team, so claim the book we hold most of and guess the rest
	//    among teammates. Bounded, and the only move left.
	return forcedClaim( beliefs, data );
}

/**
 * The book the bot is part-way through collecting: whichever it asked in most
 * recently, whether or not that ask landed and whether or not it has held the
 * turn since.
 *
 * Deliberately not scoped to the current run. Most of the bot's book-hopping
 * came from losing the turn and then re-picking from scratch when it came back
 * — which is precisely where a human player would carry on where they left off,
 * and precisely what makes a bot hard to follow.
 */
function activeBook( data: FishBotData ) {
	const last = asksOf( data.state ).findLast( ask => ask.playerId === data.state.playerId );
	return last ? getBookForCard( last.cardId, data.config.type ) : undefined;
}

/**
 * Prefer carrying on with the active book. The bot only walks away for an ask
 * worth materially more — `BOOK_SWITCH_MARGIN` more — so a hair of difference
 * between two books never moves it, and a genuinely better opening always does.
 */
function stayOnBook(
	beliefs: Beliefs,
	data: FishBotData,
	book: Book | undefined,
	best: Snatch | undefined,
	risks: ReadonlyMap<PlayerId, number>
) {
	if ( !best ) {
		return undefined;
	}

	if ( !book || book === best.book ) {
		return best;
	}

	const staying = bestSnatch( beliefs, data, data.state.playerId, book, risks );
	if ( !staying ) {
		// Nothing left to ask for in that book — moving on is the whole point.
		return best;
	}

	return best.expected > staying.expected * BOOK_SWITCH_MARGIN ? best : staying;
}

/** The teammate with cards and the best prospects, if there is one. */
function bestTeammate( data: FishBotData, seats: ReadonlyMap<PlayerId, Beliefs> ) {
	let best: { pid: PlayerId; score: number } | undefined;

	for ( const pid of teamMatesOf( data.context, data.state.playerId ) ) {
		const theirs = seats.get( pid );
		if ( !theirs ) {
			continue;
		}

		const score = snatchScore( theirs, data, pid );
		if ( !best || score > best.score ) {
			best = { pid, score };
		}
	}

	return best?.pid;
}

/**
 * Books the bot can prove its own team holds in full, *and* holds a card of
 * itself — both `askCard` and `claimBook` require being in the book, so a book
 * sitting entirely in a teammate's hand is theirs to call, not ours.
 *
 * Completely safe to sit on. Nobody outside the team can ask in the book, and
 * since the same rule governs claiming, nobody outside the team can call it
 * either. A banked book cannot be taken; it can only be given away by claiming
 * it wrong.
 */
function bankedBooks( beliefs: Beliefs, data: FishBotData ) {
	const teammates = teamMatesOf( data.context, data.state.playerId );
	const ours = new Set<PlayerId>( [ data.state.playerId, ...teammates ] );

	return beliefs.liveBooks.filter( book => {
		const cards = beliefs.cardsOf.get( book ) ?? [];
		if ( cards.length !== getCardsOfBook( book ).length ) {
			return false;
		}

		if ( !cards.some( card => data.state.hand.includes( card ) ) ) {
			return false;
		}

		return cards.every( card => {
			const owner = beliefs.owner.get( card );
			return owner !== undefined && ours.has( owner );
		} );
	} );
}

/**
 * Which banked book to cash now, if any. Three reasons to spend one; absent all
 * of them, the bank keeps its value by staying unspent.
 *
 * There is deliberately no "cash it before someone steals it" case. Claiming a
 * book requires holding one of its cards, and a banked book has none outside the
 * team — so it cannot be taken, however obvious its whereabouts have become.
 */
function chooseCashIn(
	beliefs: Beliefs,
	data: FishBotData,
	seats: ReadonlyMap<PlayerId, Beliefs>,
	banked: Book[],
	ask?: Snatch
) {
	if ( banked.length === 0 ) {
		return undefined;
	}

	// a. No ask left, or every remaining book is already ours — nobody can move
	//    the game on. Cash in; this is what keeps the game terminating.
	const bankedSet = new Set( banked );
	if ( !ask || beliefs.liveBooks.every( book => bankedSet.has( book ) ) ) {
		return cheapest( beliefs, data.state, banked );
	}

	// b. The endgame. A banked book is only worth holding while there are turns
	//    left to buy with it, and cashing out now settles the game: even if every
	//    book still in play went the other way, our side would finish ahead. Bank
	//    value becomes score, and there is nothing left to spend it on.
	if ( clinches( data, banked, beliefs ) ) {
		return cheapest( beliefs, data.state, banked );
	}

	// c. The handoff. A teammate is better placed than we are, so buy them the
	//    turn — but only with a book whose claim leaves them holding cards, or
	//    the transfer that follows would not be legal.
	for ( const pid of teamMatesOf( data.context, data.state.playerId ) ) {
		const theirs = seats.get( pid );
		if ( !theirs ) {
			continue;
		}

		if ( snatchScore( theirs, data, pid ) <= ask.potential * HOLD_MARGIN ) {
			continue;
		}

		const usable = banked.filter(
			book => cardsHeldIn( beliefs, book, pid ) < data.state.cardCounts[ pid ]!
		);

		if ( usable.length > 0 ) {
			return cheapest( beliefs, data.state, usable );
		}
	}

	return undefined;
}

/**
 * Whether cashing the bank settles the game: our side's books plus the bank,
 * against every other side's books plus every book still in play that we cannot
 * call ourselves.
 *
 * Deliberately pessimistic — it hands *all* the uncalled books to each rival in
 * turn — so it only fires when the lead is genuinely beyond reach and the bank
 * has no further use as tempo.
 */
function clinches( data: FishBotData, banked: readonly Book[], beliefs: Beliefs ) {
	const ours = teamOf( data.context, data.state.playerId );
	if ( ours === undefined ) {
		return false;
	}

	const scores = getTeamScores( claimsOf( data.state ), data.context, data.config.teams );
	const mine = ( scores[ ours ] ?? 0 ) + banked.length;
	const contested = beliefs.liveBooks.length - banked.length;

	return data.config.teams
		.filter( team => team !== ours )
		.every( team => mine > ( scores[ team ] ?? 0 ) + contested );
}

/** How many of a book's cards are proven to be in a player's hand. */
function cardsHeldIn( beliefs: Beliefs, book: Book, playerId: PlayerId ) {
	const cards = beliefs.cardsOf.get( book ) ?? [];
	return cards.filter( card => beliefs.owner.get( card ) === playerId ).length;
}

/** The banked book that costs the bot the fewest cards from its own hand. */
function cheapest( beliefs: Beliefs, view: FishSeatView, banked: readonly Book[] ) {
	return banked.toSorted( ( a, b ) => {
		const cost = cardsHeldIn( beliefs, a, view.playerId ) -
			cardsHeldIn( beliefs, b, view.playerId );
		return cost !== 0 ? cost : a.localeCompare( b );
	} )[ 0 ];
}

/** The claim for a book every one of whose holders is proven. */
function provenClaim( beliefs: Beliefs, book: Book ) {
	const claim: Record<string, PlayerId> = {};
	for ( const card of getCardsOfBook( book ) ) {
		claim[ card ] = beliefs.owner.get( card )!;
	}

	return claim;
}

/**
 * The last resort: no ask, nothing proven. Every remaining card of the books we
 * hold is with our own team, so claim the book we hold most of and give each
 * unproven card to the teammate most likely to have it.
 */
function forcedClaim( beliefs: Beliefs, data: FishBotData ) {
	const teammates = teamMatesOf( data.context, data.state.playerId );
	const ours = [ data.state.playerId, ...teammates ];
	// Only a book we are in — `claimBook` requires holding one of its cards. Any
	// player still holding a card is in that card's book, so this is empty only
	// when the bot has no cards at all, and then it has no legal move to make.
	const books = beliefs.liveBooks
		.filter(
			book => ( beliefs.cardsOf.get( book ) ?? [] ).some( c => data.state.hand.includes( c ) )
		)
		.toSorted( ( a, b ) => {
			const held = cardsHeldIn( beliefs, b, data.state.playerId ) -
				cardsHeldIn( beliefs, a, data.state.playerId );
			return held !== 0 ? held : a.localeCompare( b );
		} );

	const book = books[ 0 ];
	if ( !book ) {
		return undefined;
	}

	// Only ever names our own side. A claim naming an opponent is refused outright
	// — it is not a losing claim, it is an illegal one — so a card proven to be
	// with the other side is guessed onto the likeliest of us instead, and the
	// declaration goes down as the wrong claim it always was.
	const claim: Record<string, PlayerId> = {};
	for ( const card of getCardsOfBook( book ) ) {
		const owner = beliefs.owner.get( card );
		claim[ card ] = owner !== undefined && ours.includes( owner )
			? owner
			: likeliestOf( beliefs, card, ours );
	}

	return { moveType: "claimBook" as const, input: { claim } };
}

/** Whichever of `players` is most likely to hold the card. */
function likeliestOf( beliefs: Beliefs, card: CardId, players: readonly PlayerId[] ) {
	let best = players[ 0 ]!;
	let bestProb = -1;

	for ( const pid of players ) {
		const p = probability( beliefs, card, pid );
		if ( p > bestProb ) {
			best = pid;
			bestProb = p;
		}
	}

	return best;
}
