import {
	buildBeliefs,
	holdsBookProbability,
	probability
} from "@/games/fish/server/bot/beliefs.ts";
import { membersOf, opponentsOf, teamOf } from "@/swish/shared/teams.ts";

import type { Beliefs } from "@/games/fish/server/bot/beliefs.ts";
import type { Book, FishBotData } from "@/games/fish/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { GameContext, PlayerId } from "@/swish/shared/schema.ts";

// --- How well placed a player is to take a book off the opponents -----------
// Read off the belief model, and used for three things: picking the bot's own
// ask, picking who to hand the turn to, and deciding when a banked claim is
// worth spending.
//
// Asks are ranked on ONE number: the books an ask is expected to be worth, net of
// what missing costs. A card is worth its share of the book it belongs to — a
// book needing one more card is a whole book away from being won, so that card is
// worth 1, while a card in a book needing four is worth a quarter of one. Missing
// hands the turn to whoever was asked, so their own prospects come off the top.
//
// That single expectation replaced a lexicographic rule that closed the nearest
// book first and only consulted the odds to break ties. It chased long shots at
// nearly-finished books and paid for them in turns: a fifth of its asks landed.

/** Differences below this are noise in an expectation, not a gap. */
const EPSILON = 1e-9;

/** The best ask available to a player, and what it is worth. */
export type Snatch = {
	readonly playerId: PlayerId;
	readonly cardId: CardId;
	readonly from: PlayerId;
	readonly book: Book;
	/** Expected cards of the book not yet with the player's team. Lower is closer. */
	readonly outstanding: number;
	/** P( the ask succeeds ). */
	readonly success: number;
	/** Books this ask is expected to be worth: `success` × the card's share of one. */
	readonly potential: number;
	/** How well placed the player being asked is to take a book, if this misses. */
	readonly risk: number;
	/** `potential` net of what a miss hands the target. The number asks are ranked on. */
	readonly expected: number;
};

/**
 * Ranks two asks: expected books first, then — for asks the model cannot separate
 * — the one that closes a book soonest, and the likelier of those.
 *
 * The tie-break is what keeps the bot readable at the table. It follows the same
 * book across turns rather than hopping between equally-valued asks, and it never
 * overrides the expectation: two asks have to be worth the same before it speaks.
 *
 * @param a - The ask being considered.
 * @param b - The ask to beat.
 * @returns `true` when `a` is the better ask.
 * @public
 */
export function isBetterAsk( a: Snatch, b: Snatch ) {
	if ( Math.abs( a.expected - b.expected ) > EPSILON ) {
		return a.expected > b.expected;
	}

	if ( Math.abs( a.outstanding - b.outstanding ) > EPSILON ) {
		return a.outstanding < b.outstanding;
	}

	return a.success > b.success;
}

/**
 * A belief model per seat, each built from what that seat knows.
 *
 * An opponent's prospects have to be measured with *their* knowledge, not ours:
 * our own hand tells us where cards are not, which sharpens our picture of what
 * they could be chasing into something they cannot actually see. Scoring them
 * from our model systematically overstated them, and the bot swerved away from
 * targets that were no danger at all.
 *
 * What they certainly do know is their own hand, so each perspective is seeded
 * with the cards we have proved are theirs — a lower bound on it, and the only
 * part of it we are entitled to.
 *
 * @param data - The acting bot's game data.
 * @param own - The bot's own model, for the proofs it has about other hands.
 * @returns A model per other seated player, keyed by player.
 * @public
 */
export function seatBeliefs( data: FishBotData, own: Beliefs ) {
	const models = new Map<PlayerId, Beliefs>();

	for ( const playerId of data.context.players ) {
		if ( playerId === data.state.playerId || ( data.state.cardCounts[ playerId ] ?? 0 ) <= 0 ) {
			continue;
		}

		const hand = [ ...own.owner ]
			.filter( ( [ , holder ] ) => holder === playerId )
			.map( ( [ card ] ) => card );

		models.set(
			playerId,
			buildBeliefs( data.state, data.config, { playerId, hand, complete: false } )
		);
	}

	return models;
}

/**
 * How well placed each opponent is to take a book, i.e. what it costs to hand
 * them the turn by asking them for a card they turn out not to have.
 *
 * @param data - The acting bot's game data.
 * @param seats - The per-seat models from {@link seatBeliefs}.
 * @returns Opponent id → how dangerous it is to give them the turn, in books.
 * @public
 */
export function opponentRisk( data: FishBotData, seats: ReadonlyMap<PlayerId, Beliefs> ) {
	const risk = new Map<PlayerId, number>();

	for ( const pid of opponentsOf( data.context, data.state.playerId ) ) {
		const theirs = seats.get( pid );
		if ( theirs ) {
			risk.set( pid, snatchScore( theirs, data, pid ) );
		}
	}

	return risk;
}

/**
 * The strongest ask `playerId` could make right now.
 *
 * Exact for the bot itself, which knows its own hand: every "do they hold this"
 * term collapses to 1 or 0. For anyone else the terms come from their own model.
 *
 * The value of an ask is
 *
 *     expected = success × ( 1 / outstanding ) − ( 1 − success ) × risk( target )
 *
 * A miss hands the turn to whoever was asked, so asking a player who is poised
 * to take a book pays for their book with your turn. Netting that off is what
 * keeps the bot away from them — and it does so without a cutoff: a target who
 * certainly holds the card is still asked however dangerous they are, because
 * there is no miss to pay for.
 *
 * @param beliefs - The belief model to score with — the asker's own.
 * @param data - The acting bot's game data.
 * @param playerId - Whose prospects to score.
 * @param onlyBook - Restrict to one book, for "can I carry on where I was?".
 * @param risks - What it costs to hand each opponent the turn; see {@link opponentRisk}.
 * @returns The best ask, or `undefined` when the player has none.
 * @public
 */
export function bestSnatch(
	beliefs: Beliefs,
	{ state, context }: FishBotData,
	playerId: PlayerId,
	onlyBook?: Book,
	risks?: ReadonlyMap<PlayerId, number>
) {
	if ( ( state.cardCounts[ playerId ] ?? 0 ) <= 0 ) {
		return undefined;
	}

	const opponents = opponentsOf( context, playerId )
		.filter( pid => ( state.cardCounts[ pid ] ?? 0 ) > 0 );

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

		const share = teamShare( beliefs, context, book, playerId );
		const cards = beliefs.cardsOf.get( book ) ?? [];
		const outstanding = cards.length * ( 1 - share );

		// What one of its cards is worth: a book needing one more card is one card
		// from being a whole book, so that card is worth a whole one.
		const gain = 1 / Math.max( outstanding, 1 );

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
				const potential = success * gain;

				const candidate = {
					playerId,
					cardId,
					from,
					book,
					outstanding,
					success,
					potential,
					risk,
					expected: potential - ( 1 - success ) * risk
				};

				if ( !best || isBetterAsk( candidate, best ) ) {
					best = candidate;
				}
			}
		}
	}

	return best;
}

/**
 * What a player's best ask is worth before the downside — the measure of how well
 * placed they are, used to compare seats rather than to pick between asks.
 *
 * Risk is deliberately left out: it prices handing the turn *away*, which is a
 * cost to whoever is asking, not part of how dangerous that player is.
 *
 * @param beliefs - The model to score with — that player's own.
 * @param data - The acting bot's game data.
 * @param playerId - Whose prospects to score.
 * @returns The books their best ask is expected to be worth, or 0 when they have none.
 * @public
 */
export function snatchScore( beliefs: Beliefs, data: FishBotData, playerId: PlayerId ) {
	return bestSnatch( beliefs, data, playerId )?.potential ?? 0;
}

/**
 * The share of a book expected to already sit with the player's own team. An
 * ask that finishes a book scores above one that merely opens it — this is the
 * "snatch a book" part of the score.
 */
export function teamShare(
	beliefs: Beliefs,
	context: GameContext,
	book: Book,
	playerId: PlayerId
) {
	const teamId = teamOf( context, playerId );
	const cards = beliefs.cardsOf.get( book ) ?? [];
	if ( cards.length === 0 || teamId === undefined ) {
		return 0;
	}

	let held = 0;
	for ( const card of cards ) {
		for ( const member of membersOf( context, teamId ) ) {
			held += probability( beliefs, card, member );
		}
	}

	return held / cards.length;
}
