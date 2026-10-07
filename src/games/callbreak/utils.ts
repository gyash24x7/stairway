import type { CallbreakState, CallbreakView, Trick } from "@/games/callbreak/schema";
import {
	CALLBREAK_MIN_DECLARATION,
	CALLBREAK_TRICKS_PER_DEAL,
	Deal
} from "@/games/callbreak/schema";
import type { CardId, CardRank, CardSuit } from "@/shared/utils/cards";
import {
	generateDeck,
	generateHands,
	getCardRank,
	getCardSuit,
	getSortedHand
} from "@/shared/utils/cards";
import type { Rng } from "@/shared/utils/rng";
import type { PlayerId } from "@/swish/schema";

/**
 * Trick-taking order, weakest first. Aces are high in Callbreak, which is why
 * this is not the deck's own `A`-first ordering — `getCardValue` indexes into
 * it, so the array *is* the ranking.
 */
export const RANK_ORDER: ReadonlyArray<CardRank> = [
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
	"A"
];

/**
 * Where a card sits in the trick-taking order.
 * @param card - The card to rank.
 * @returns Its index in {@link RANK_ORDER} — higher beats lower within a suit.
 */
export function getCardValue( card: CardId ) {
	return RANK_ORDER.indexOf( getCardRank( card ) );
}

/**
 * The highest card of one suit among a set, as a rank value.
 * @param cards - The cards to look through.
 * @param suit - The suit to measure.
 * @returns The best value of that suit, or `-1` when the suit is absent.
 */
export function getHighestCardValue( cards: ReadonlyArray<CardId>, suit: CardSuit ) {
	return cards
		.filter( card => getCardSuit( card ) === suit )
		.reduce( ( max, card ) => Math.max( max, getCardValue( card ) ), -1 );
}

/**
 * The seats of a trick in the order they actually played into it.
 *
 * `context.players` is the seating order, which is only the play order for the
 * trick the first seat happens to lead. Every other trick starts wherever the
 * previous one was won, so reading a trick in seat order shows the cards in an
 * order nobody played them in — and the lead card, which decides what everyone
 * else was allowed to follow with, lands in an arbitrary position.
 *
 * @param trick - The trick to read.
 * @param players - The seating order to rotate.
 * @returns The seats, starting at the trick's leader.
 */
export function trickPlayOrder( trick: Trick, players: ReadonlyArray<PlayerId> ) {
	const lead = players.indexOf( trick.leadPlayer );
	if ( lead < 0 ) {
		return players;
	}

	return [ ...players.slice( lead ), ...players.slice( 0, lead ) ];
}

/**
 * The cards a seat may legally play into a trick. Callbreak is stricter than
 * most trick-takers: following suit is not enough, you must head the trick when
 * you can.
 *
 * - Leading, or holding nothing relevant: anything in hand.
 * - Holding the led suit: play it, and play higher than everything of that suit
 *   already down unless a trump has already taken the trick away.
 * - Void in the led suit but holding trump: trump it, and overtrump if a trump
 *   is already down. Unable to overtrump, the seat is free to throw anything.
 *
 * @param hand - The seat's cards.
 * @param trump - The game's trump suit.
 * @param trick - The trick being played into.
 * @returns The subset of `hand` that may be played.
 */
export function getPlayableCards(
	hand: ReadonlyArray<CardId>,
	trump: CardSuit,
	trick: Trick
) {
	const trickCards = Object.values( trick.cards );
	const leadSuit = trick.suit;

	// Leading the trick — any card.
	if ( trickCards.length === 0 || !leadSuit ) {
		return [ ...hand ];
	}

	const suitCards = hand.filter( card => getCardSuit( card ) === leadSuit );

	if ( suitCards.length > 0 ) {
		// A trump on a plain-suit trick has already taken it, so following suit
		// is all that is left to do.
		if ( leadSuit !== trump && trickCards.some( card => getCardSuit( card ) === trump ) ) {
			return suitCards;
		}

		const highestPlayed = getHighestCardValue( trickCards, leadSuit );
		const higherCards = suitCards.filter( card => getCardValue( card ) > highestPlayed );
		return higherCards.length > 0 ? higherCards : suitCards;
	}

	const trumpCards = hand.filter( card => getCardSuit( card ) === trump );

	if ( trumpCards.length > 0 ) {
		const highestTrumpPlayed = getHighestCardValue( trickCards, trump );
		if ( highestTrumpPlayed < 0 ) {
			return trumpCards;
		}

		const higherTrumps = trumpCards.filter(
			card => getCardValue( card ) > highestTrumpPlayed
		);

		return higherTrumps.length > 0 ? higherTrumps : [ ...hand ];
	}

	// Void in the led suit and holding no trump — nothing to enforce.
	return [ ...hand ];
}


/**
 * Who is taking the trick as it stands.
 *
 * A trump beats every plain card whatever was led, so the contenders are the
 * trumps when any have been played and the cards of the led suit otherwise. A
 * card of neither can never win — that is precisely what makes a discard a
 * discard — which is why the losers are filtered out before the ranks are
 * compared at all.
 *
 * @param trick - The trick to read, complete or not.
 * @param trump - The game's trump suit.
 * @returns The seat currently winning it, or `undefined` for an empty trick.
 */
export function getTrickWinner( trick: Trick, trump: CardSuit ) {
	const entries = Object.entries( trick.cards ) as Array<[ PlayerId, CardId ]>;
	if ( entries.length === 0 ) {
		return undefined;
	}

	const leadSuit = trick.suit ?? getCardSuit( entries[ 0 ]![ 1 ] );
	const trumps = entries.filter( ( [ , card ] ) => getCardSuit( card ) === trump );
	const followed = entries.filter( ( [ , card ] ) => getCardSuit( card ) === leadSuit );
	const contenders = trumps.length > 0 ? trumps : followed;

	return ( contenders.length > 0 ? contenders : entries ).reduce(
		( best, entry ) => getCardValue( entry[ 1 ] ) > getCardValue( best[ 1 ] ) ? entry : best
	)[ 0 ];
}

/**
 * What a deal came to, in tenths of a point.
 *
 * A made contract pays its declaration and a tenth for every trick beyond it; a
 * broken one is charged the whole declaration. Kept in tenths rather than in
 * points because the overtrick *is* a tenth, and a running total of integers is
 * exact where a running total of `0.1` drifts — which matters, since the whole
 * table is ranked on that total at the end.
 *
 * A seat that never declared reads as `0`, and `0` is not a legal call, so it
 * neither scores nor loses: the sentinel carries through the arithmetic as the
 * absence it stands for.
 *
 * @param players - The seats to score, in seating order.
 * @param declarations - What each seat called for the deal.
 * @param wins - How many tricks each seat actually took.
 * @returns Each seat's score for the deal, in tenths.
 */
export function scoreDeal(
	players: ReadonlyArray<PlayerId>,
	declarations: Readonly<Record<PlayerId, number>>,
	wins: Readonly<Record<PlayerId, number>>
) {
	const scores: Record<PlayerId, number> = {};

	for ( const playerId of players ) {
		const declared = declarations[ playerId ] ?? 0;
		const won = wins[ playerId ] ?? 0;
		scores[ playerId ] = won >= declared
			? declared * 10 + ( won - declared )
			: -declared * 10;
	}

	return scores;
}


// --- Policy ----------------------------------------------------------------

/**
 * How many tricks a hand is worth calling.
 *
 * Counted rather than searched: an ace takes its trick, a king takes it about
 * half the time, and a trump is worth a trick outright once it is high enough
 * that nothing routine overtrumps it. That is deliberately crude — a policy
 * that bid perfectly would be a better partner than any of the people at the
 * table — but it is plausible, and it never calls something the rules refuse.
 *
 * @param hand - The seat's thirteen cards.
 * @param trump - The game's trump suit.
 * @returns A declaration inside the legal range.
 */
export function declareFromHand( hand: ReadonlyArray<CardId>, trump: CardSuit ) {
	const middling = RANK_ORDER.indexOf( "10" );
	let expected = 0;

	for ( const card of hand ) {
		const rank = getCardRank( card );

		if ( getCardSuit( card ) === trump ) {
			expected += getCardValue( card ) >= middling ? 1 : 0.5;
			continue;
		}

		if ( rank === "A" ) {
			expected += 1;
		} else if ( rank === "K" ) {
			expected += 0.5;
		}
	}

	return Math.min(
		CALLBREAK_TRICKS_PER_DEAL,
		Math.max( CALLBREAK_MIN_DECLARATION, Math.round( expected ) )
	);
}

/**
 * Which card a seat the game plays puts down.
 *
 * Every candidate comes from {@link getPlayableCards}, so the choice is legal
 * before it is judged — the policy picks among the moves the rules already
 * allow rather than proposing one and being refused. From there: lead the best
 * plain card and keep the trumps for later, take the trick with the cheapest
 * card that takes it, and throw the cheapest card when it cannot be taken.
 *
 * A trump is weighed above every plain card regardless of rank, which is what
 * makes "cheapest" mean *keep the trumps* rather than merely *lowest number*.
 *
 * @param playerId - The seat being played for.
 * @param hand - Its cards.
 * @param trump - The game's trump suit.
 * @param trick - The trick being played into.
 * @returns The card to play, or `undefined` when the hand is empty.
 */
export function chooseCard(
	playerId: PlayerId,
	hand: ReadonlyArray<CardId>,
	trump: CardSuit,
	trick: Trick
) {
	const playable = getPlayableCards( hand, trump, trick );
	if ( playable.length === 0 ) {
		return undefined;
	}

	const weigh = ( card: CardId ) =>
		getCardValue( card ) + ( getCardSuit( card ) === trump ? RANK_ORDER.length : 0 );

	if ( Object.keys( trick.cards ).length === 0 ) {
		const plain = playable.filter( card => getCardSuit( card ) !== trump );
		const leads = plain.length > 0 ? plain : playable;
		return leads.reduce( ( best, card ) => weigh( card ) > weigh( best ) ? card : best );
	}

	const winners = playable.filter( card => getTrickWinner( {
		...trick,
		suit: trick.suit ?? getCardSuit( card ),
		cards: { ...trick.cards, [ playerId ]: card }
	}, trump ) === playerId );

	const candidates = winners.length > 0 ? winners : playable;
	return candidates.reduce( ( best, card ) => weigh( card ) < weigh( best ) ? card : best );
}

/** The deal in play — `deals` is kept newest-first, so it is always the head. */
export const activeDealOf = ( state: CallbreakState ) => state.deals.at( 0 );

/** The trick in play — `tricks` is kept newest-first for the same reason. */
export const activeTrickOf = ( deal: Deal | undefined ) => deal?.tricks.at( 0 );

/**
 * The trick the table should be looking at, which is not always the one in play.
 *
 * The fourth card into a trick is committed together with the trick's winner and
 * the opening of the next one — and, on the thirteenth, with the next deal being
 * cut. So by the time any client sees that card, the trick it completed is no
 * longer at the head of anything: drawing only the trick in play would show the
 * first three cards and then an empty table, and nobody would ever see what won.
 *
 * So the completed trick stays up until the table moves past it: until its
 * winner leads the next one, or — once the deal is over — until the first seat
 * declares for the next deal.
 *
 * @param view - The table as one audience sees it.
 * @returns The trick to draw, or `undefined` when there is none to show.
 */
export function displayedTrick( view: CallbreakView ) {
	const deal = view.activeDeal;
	const active = deal?.tricks.at( 0 );
	if ( !deal || ( active && Object.keys( active.cards ).length > 0 ) ) {
		return active;
	}

	if ( !active ) {
		const declared = Object.values( deal.declarations )
			.some( wins => wins >= CALLBREAK_MIN_DECLARATION );

		return declared ? undefined : view.lastCompletedTrick;
	}

	return view.lastCompletedTrick ?? active;
}

/**
 * Whether a deal is finished. A deal's `scores` is empty until it is scored and
 * filled in one go by `DealScored`, so its emptiness is the only marker of
 * "finished" the state carries — and unlike a trick count it survives the next
 * deal being dealt on top of it.
 */
export const isScored = ( deal: Deal ) => Object.keys( deal.scores ).length > 0;

/**
 * Cuts a fresh deal for the table.
 *
 * The shuffle is salted with the deal's own index so every deal in a game draws
 * a different stream off the one seed: the engine salts per commit, but a
 * replay of the same commit has to produce the same cards, and `deal-3` is what
 * makes the third deal reproducibly different from the first.
 *
 * `declarations` and `wins` are seeded at zero for every seat rather than left
 * absent, because `0` is the declaring phase's sentinel for "has not called
 * yet" — a missing key and a zero would then mean the same thing to the phase's
 * `endIf` but different things to a client counting the calls in.
 *
 * @param players - The seating order to deal to.
 * @param index - How many deals have already been cut, which is also this one's.
 * @param rng - The commit's RNG factory.
 * @returns The deal to announce with `DealDealt`.
 */
export const dealFor = (
	players: ReadonlyArray<PlayerId>,
	index: number,
	rng: ( salt?: string ) => Rng
) => {
	const hands = generateHands( generateDeck( rng( `deal-${ index }` ).next ), players.length );

	return Deal.make( {
		id: `deal-${ index + 1 }`,

		// The deal passes round the table, so the seat that opens the first deal is
		// not the seat that opens the second. Derived from the index rather than
		// carried forward, which keeps it a function of the log alone.
		startingPlayer: players[ index % players.length ]!,
		hands: Object.fromEntries(
			players.map( ( playerId, seat ) => [ playerId, getSortedHand( [ ...hands[ seat ]! ] ) ] )
		),
		declarations: Object.fromEntries( players.map( playerId => [ playerId, 0 ] ) ),
		wins: Object.fromEntries( players.map( playerId => [ playerId, 0 ] ) ),
		scores: {},
		tricks: []
	} );
};
