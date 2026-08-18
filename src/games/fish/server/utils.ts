import type * as Types from "effect/Types";

import { FISH_MOVE_TIMEOUT_MILLIS } from "@/games/fish/shared/schema.ts";
import {
	CANADIAN_BOOKS,
	claimsOf,
	getBooksInHand,
	getCardsOfBook,
	NORMAL_BOOKS
} from "@/games/fish/shared/utils.ts";

import type { Ask, Book, BookType, Metrics, PlayerCount, TeamCount } from "@/games/fish/shared/schema.ts";
import type { PublicKnowledge } from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId, TeamId } from "@/swish/shared/schema.ts";

/**
 * Checks if a specific book is present in a player's hand.
 * @param hand - The player's hand of cards
 * @param book - The book to check for
 * @param bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @returns True if the book is in hand, false otherwise
 * @public
 */
export function isBookInHand( hand: readonly CardId[], book: Book, bookType: BookType ) {
	return getBooksInHand( hand, bookType ).includes( book );
}

/**
 * The ids a table's sides are declared with, in the order the config lists them.
 * They are ids, not labels: swish keys membership, the balancing at `start` and the
 * per-side standings by them, so what a side calls itself is separate — players
 * choose that in the lobby with `nameTeam`, and `nameOf` reads it back.
 */
export const FISH_TEAMS = [ "TEAM_1", "TEAM_2", "TEAM_3", "TEAM_4" ] as TeamId[];

/**
 * The asks out of a table's history, oldest first.
 *
 * @param known - The table's public knowledge.
 * @returns Every ask, in the order they were made.
 */
export const asksOf = ( known: PublicKnowledge ) =>
	known.moves.filter( ( move ): move is Ask => move._tag === "fish/Ask" );

/**
 * Return all books that have been declared, won or lost.
 *
 * A declaration takes its book out of play whether or not it was right, so this
 * is also the list of books no longer askable.
 *
 * @param known - The table's public knowledge.
 * @returns An array of declared book names, oldest first.
 */
export function getClaimedBooks( known: PublicKnowledge ) {
	return claimsOf( known ).map( claim => claim.book );
}

/**
 * The books still in play.
 *
 * @param known - The table's public knowledge.
 * @param books - Every book this variant deals with, from the config.
 * @returns The books nobody has declared yet, in the config's order.
 */
export function getLiveBooks( known: PublicKnowledge, books: readonly Book[] ) {
	const claimed = new Set( getClaimedBooks( known ) );
	return books.filter( book => !claimed.has( book ) );
}

/**
 * Whether the table is played out: every book declared, so there is nothing left
 * to ask for.
 *
 * This is the game's own end condition — `endIf` is this function — and it is
 * also what tells the `view` a game is over. The view is built from state and
 * config alone and never sees the engine's `status`, so a game that can say when
 * it has finished from its own state is a game whose view can too.
 *
 * @param known - The table's public knowledge.
 * @param books - Every book this variant deals with, from the config.
 * @returns `true` once no book is left in play.
 */
export function isGameComplete( known: PublicKnowledge, books: readonly Book[] ) {
	return getLiveBooks( known, books ).length === 0;
}

/**
 * What each seat did with its game, folded out of the histories.
 *
 * Every figure is a count over the move history, which is public
 * and complete, so this is a summary rather than a source: nothing here is state,
 * and a client can recompute the whole table from the same view it renders.
 *
 * - totalAsks / cardsTaken: How often a seat asked, and how often it landed
 * - cardsGiven: How often a seat was asked and had to hand the card over — the
 * 		other side of `cardsTaken`, so the two totals match across the table
 * - totalClaims / successfulClaims: How often a seat declared, and how often it
 * 		was right. The difference is books it gave away
 *
 * @param known - The table's public knowledge.
 * @param players - The seats to report on, in seating order.
 * @returns One entry per seat, zeroed for a seat that never acted.
 */
export function getMetrics( known: PublicKnowledge, players: readonly PlayerId[] ) {
	// Counted up in place, then handed back as the readonly shape the view carries.
	const metrics: Record<PlayerId, Types.DeepMutable<Metrics>> = {};

	for ( const playerId of players ) {
		metrics[ playerId ] = {
			totalAsks: 0,
			cardsTaken: 0,
			cardsGiven: 0,
			totalClaims: 0,
			successfulClaims: 0
		};
	}

	for ( const ask of asksOf( known ) ) {
		const asker = metrics[ ask.playerId ];
		if ( asker ) {
			asker.totalAsks = asker.totalAsks + 1;
			asker.cardsTaken = asker.cardsTaken + ( ask.success ? 1 : 0 );
		}

		const target = metrics[ ask.from ];
		if ( target && ask.success ) {
			target.cardsGiven = target.cardsGiven + 1;
		}
	}

	for ( const claim of claimsOf( known ) ) {
		const declarer = metrics[ claim.playerId ];
		if ( declarer ) {
			declarer.totalClaims = declarer.totalClaims + 1;
			declarer.successfulClaims = declarer.successfulClaims + ( claim.success ? 1 : 0 );
		}
	}

	return metrics;
}

/**
 * Who could still be holding each card in play, from the table's public knowledge
 * alone — the deductions everyone at the table is entitled to make, and the floor
 * a player's own hand then improves on.
 *
 * Three facts do all the work, and each is permanent rather than momentary:
 *
 * - A card only moves by being asked away, so the **latest successful ask** for a
 * 	 card says exactly where it is, and nothing since can have moved it without
 * 	 another ask.
 * - A **failed** ask rules out two seats for good: the one asked did not hold it,
 * 	 and the one asking cannot have (you may not ask for a card you hold). Neither
 * 	 can have picked it up since without an ask of their own, which would be later
 * 	 in the history and is applied after this one.
 * - A seat **out of cards** holds nothing.
 *
 * Reading the history in order is what keeps those in agreement: a pin from a
 * successful ask is laid down first and any later refusal narrows it, never the
 * other way round.
 *
 * @param known - The table's public knowledge.
 * @param books - Every book this variant deals with, from the config.
 * @returns Card → the seats that could hold it, for every card still in play.
 */
export function possibleHolders( known: PublicKnowledge, books: readonly Book[] ) {
	const seated = ( Object.keys( known.cardCounts ) as PlayerId[] )
		.filter( playerId => ( known.cardCounts[ playerId ] ?? 0 ) > 0 );

	const holders = new Map<CardId, PlayerId[]>();
	for ( const book of getLiveBooks( known, books ) ) {
		for ( const card of getCardsOfBook( book ) ) {
			holders.set( card, [ ...seated ] );
		}
	}

	for ( const ask of asksOf( known ) ) {
		const candidates = holders.get( ask.cardId );
		if ( !candidates ) {
			// Its book has since been declared, so the card is out of play.
			continue;
		}

		holders.set(
			ask.cardId,
			ask.success
				? [ ask.playerId ]
				: candidates.filter( pid => pid !== ask.from && pid !== ask.playerId )
		);
	}

	return holders;
}

/**
 * Build a FishConfig object from create game input parameters.
 * Determines book type, deck size, and book definitions based on the game variant.
 *
 * The deck has to divide evenly between the seats — the deal is all of it, and a
 * remainder would leave books nobody can complete. 52 only divides four seats, so
 * a NORMAL game at six or eight drops the sevens for the same 48-card deck the
 * CANADIAN variant always uses, and drops the `SEVENS` book with them: `endIf`
 * counts declarations against `books`, so a book with no cards in play would leave
 * the table one claim short of ever finishing.
 *
 * @param playerCount No of players
 * @param type Book Type for the game
 * @param teamCount No of teams, which must divide `playerCount` evenly
 * @returns A complete FishConfig object.
 */
export function buildConfig( playerCount: PlayerCount, type: BookType, teamCount: TeamCount ) {
	const isCanadian = type === "CANADIAN";
	const deckType = !isCanadian && 52 % playerCount === 0 ? 52 as const : 48 as const;

	const books = ( isCanadian
			? Object.keys( CANADIAN_BOOKS )
			: Object.keys( NORMAL_BOOKS ).filter( book => deckType === 52 || book !== "SEVENS" )
	) as Book[];

	return {
		type,
		playerCount,
		teams: FISH_TEAMS.slice( 0, teamCount ),
		deckType,
		books,
		bookSize: isCanadian ? 6 as const : 4 as const,
		autoStart: false,
		moveTimeoutMillis: FISH_MOVE_TIMEOUT_MILLIS
	};
}
