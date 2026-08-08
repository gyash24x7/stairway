import {
	type Beliefs,
	holdsBookProbability,
	probability
} from "@/games/fish/server/bot/beliefs.ts";
import type { Book, FishPlayerView } from "@/games/fish/shared/schema.ts";
import { getOpponents, getTeamForPlayer } from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";

// --- How well placed a player is to take a book off the opponents -----------
// Read off the belief model, and used for three things: picking the bot's own
// ask, picking who to hand the turn to, and deciding when a banked claim is
// worth spending.
//
// Asks are ranked to CLOSE BOOKS, not to keep the turn: the fewest cards left
// to collect wins, and only ties are settled on the odds. So a bot with one ace
// outstanding hunts that ace even at long odds, rather than retreating to a
// safer book — losing the turn on a long shot costs less than never finishing
// anything, and it is far easier to follow.

/** Cards-outstanding differences below this are noise in an expectation, not a gap. */
const EPSILON = 1e-9;

/** The best ask available to a player, and what it is worth. */
export type Snatch = {
	readonly playerId: PlayerId;
	readonly cardId: CardId;
	readonly from: PlayerId;
	readonly book: Book;
	/** Expected cards of the book not yet with the player's team. Lower is closer. */
	readonly outstanding: number;
	/** P( the ask succeeds ), weighted by how close the book is to being ours. */
	readonly score: number;
	/** P( the ask succeeds ) on its own. */
	readonly success: number;
	/** How well placed the player being asked is to take a book, if this misses. */
	readonly risk: number;
	/** `success` net of what a miss hands the target. See {@link bestSnatch}. */
	readonly value: number;
};

/**
 * Ranks two asks: close a book first, then net worth.
 *
 * Returns true when `a` is the better ask.
 * @public
 */
export function closesSooner( a: Snatch, b: Snatch ) {
	// A hair of tolerance, because `outstanding` is an expectation over the
	// belief model rather than a count — two books genuinely one card from home
	// should tie and fall through to what the ask is worth.
	if ( Math.abs( a.outstanding - b.outstanding ) > EPSILON ) {
		return a.outstanding < b.outstanding;
	}

	return a.value > b.value;
}

/**
 * How well placed each opponent is to take a book, i.e. what it costs to hand
 * them the turn by asking them for a card they turn out not to have.
 *
 * Read off the same belief model as everything else, which means it is built
 * from what those opponents have *asked for*: the rule that you only ask in a
 * book you hold a card of is what puts them on a book at all, and the counting
 * then says how much of it their team already holds.
 *
 * Measured with the bot's own knowledge, which is more than they have — they may
 * not yet know where the card they need is. That makes this cautious rather than
 * exact, which is the right way round for a rule about what to avoid.
 *
 * @param beliefs - The belief model for this turn.
 * @param view - The acting bot's view.
 * @returns Opponent id → how dangerous it is to give them the turn, in [0, 1].
 * @public
 */
export function opponentRisk( beliefs: Beliefs, view: FishPlayerView ) {
	const risk = new Map<PlayerId, number>();

	for ( const pid of getOpponents( view.teams, view.playerId ) ) {
		if ( ( view.cardCounts[ pid ] ?? 0 ) <= 0 ) {
			continue;
		}

		// Their own best ask, unweighted — we do not model them dodging us too.
		risk.set( pid, snatchScore( beliefs, view, pid ) );
	}

	return risk;
}

/**
 * The strongest ask `playerId` could make right now.
 *
 * Exact for the bot itself, which knows its own hand: every "do they hold this"
 * term collapses to 1 or 0. For anyone else the terms come from the model, and
 * the book's cards are treated as independent — the one approximation here.
 *
 * @param beliefs - The belief model for this turn.
 * @param view - The acting bot's view.
 * Among asks that get equally close to closing a book, the one picked is the one
 * worth most once the downside is counted:
 *
 *     value = success − ( 1 − success ) × risk( target )
 *
 * A miss hands the turn to whoever was asked, so asking a player who is poised
 * to take a book pays for their book with your turn. Netting that off is what
 * keeps the bot away from them — and it does so without a cutoff: a target who
 * certainly holds the card is still asked however dangerous they are, because
 * there is no miss to pay for. That is the "unless there is no other option"
 * part, falling out of the arithmetic rather than bolted on.
 *
 * @param beliefs - The belief model for this turn.
 * @param view - The acting bot's view.
 * @param playerId - Whose prospects to score.
 * @param onlyBook - Restrict to one book, for "can I carry on where I was?".
 * @param risks - What it costs to hand each opponent the turn; see {@link opponentRisk}.
 * @returns The best ask, or `undefined` when the player has none.
 * @public
 */
export function bestSnatch(
	beliefs: Beliefs,
	view: FishPlayerView,
	playerId: PlayerId,
	onlyBook?: Book,
	risks?: ReadonlyMap<PlayerId, number>
) {
	if ( ( view.cardCounts[ playerId ] ?? 0 ) <= 0 ) {
		return undefined;
	}

	const opponents = getOpponents( view.teams, playerId )
		.filter( pid => ( view.cardCounts[ pid ] ?? 0 ) > 0 );

	if ( opponents.length === 0 ) {
		return undefined;
	}

	let best: Snatch | undefined;

	for ( const book of beliefs.liveBooks ) {
		if ( onlyBook !== undefined && book !== onlyBook ) {
			continue;
		}

		const holdsBook = holdsBookProbability( beliefs, book, playerId );
		if ( holdsBook <= 0 ) {
			// Cannot legally ask in a book you hold nothing from.
			continue;
		}

		const share = teamShare( beliefs, view, book, playerId );
		const cards = beliefs.cardsOf.get( book ) ?? [];
		const outstanding = cards.length * ( 1 - share );

		for ( const cardId of cards ) {
			const lacks = 1 - probability( beliefs, cardId, playerId );
			if ( lacks <= 0 ) {
				continue;
			}

			for ( const from of opponents ) {
				const odds = probability( beliefs, cardId, from );
				if ( odds <= 0 ) {
					continue;
				}

				const success = holdsBook * lacks * odds;
				const risk = risks?.get( from ) ?? 0;
				const candidate = {
					playerId,
					cardId,
					from,
					book,
					outstanding,
					success,
					score: success * share,
					risk,
					value: success - ( 1 - success ) * risk
				};

				if ( !best || closesSooner( candidate, best ) ) {
					best = candidate;
				}
			}
		}
	}

	return best;
}

/** `bestSnatch`'s score, or 0 when the player has no ask at all. */
export function snatchScore( beliefs: Beliefs, view: FishPlayerView, playerId: PlayerId ) {
	return bestSnatch( beliefs, view, playerId )?.score ?? 0;
}

/**
 * The share of a book expected to already sit with the player's own team. An
 * ask that finishes a book scores above one that merely opens it — this is the
 * "snatch a book" part of the score.
 */
export function teamShare(
	beliefs: Beliefs,
	view: FishPlayerView,
	book: Book,
	playerId: PlayerId
) {
	const teamId = getTeamForPlayer( view.teams, playerId );
	const team = view.teams[ teamId ]?.members ?? [];
	const cards = beliefs.cardsOf.get( book ) ?? [];
	if ( cards.length === 0 ) {
		return 0;
	}

	let held = 0;
	for ( const card of cards ) {
		for ( const member of team ) {
			held += probability( beliefs, card, member );
		}
	}

	return held / cards.length;
}
