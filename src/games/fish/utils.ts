import type { Types } from "effect";

import type {
	Ask,
	Book,
	BookType,
	CanadianBook,
	Claim,
	ClaimBookInput,
	FishMove,
	FishState,
	Metrics,
	NormalBook,
	PlayerCount,
	Transfer
} from "@/games/fish/schema";
import {
	FISH_BOT_DELAY_MILLIS,
	FISH_MOVE_TIMEOUT_MILLIS,
	FishConfig,
	TeamCount
} from "@/games/fish/schema";
import type { CardId } from "@/shared/utils/cards";
import { getCardDisplayString } from "@/shared/utils/cards";
import type { GameContext, PlayerId, PlayerInfo, TeamId } from "@/swish/schema";

/** Mapping of normal book names to their card IDs (4 cards per book, grouped by rank). */
export const NORMAL_BOOKS = {
	ACES: [ "AC", "AD", "AH", "AS" ] as CardId[],
	TWOS: [ "2C", "2D", "2H", "2S" ] as CardId[],
	THREES: [ "3C", "3D", "3H", "3S" ] as CardId[],
	FOURS: [ "4C", "4D", "4H", "4S" ] as CardId[],
	FIVES: [ "5C", "5D", "5H", "5S" ] as CardId[],
	SIXES: [ "6C", "6D", "6H", "6S" ] as CardId[],
	SEVENS: [ "7C", "7D", "7H", "7S" ] as CardId[],
	EIGHTS: [ "8C", "8D", "8H", "8S" ] as CardId[],
	NINES: [ "9C", "9D", "9H", "9S" ] as CardId[],
	TENS: [ "10C", "10D", "10H", "10S" ] as CardId[],
	JACKS: [ "JC", "JD", "JH", "JS" ] as CardId[],
	QUEENS: [ "QC", "QD", "QH", "QS" ] as CardId[],
	KINGS: [ "KC", "KD", "KH", "KS" ] as CardId[]
} as const;

/** Mapping of Canadian book names to their card IDs (6 cards per book, grouped by suit half). */
export const CANADIAN_BOOKS = {
	LC: [ "AC", "2C", "3C", "4C", "5C", "6C" ] as CardId[],
	LD: [ "AD", "2D", "3D", "4D", "5D", "6D" ] as CardId[],
	UC: [ "8C", "9C", "10C", "JC", "QC", "KC" ] as CardId[],
	UD: [ "8D", "9D", "10D", "JD", "QD", "KD" ] as CardId[],
	LH: [ "AH", "2H", "3H", "4H", "5H", "6H" ] as CardId[],
	UH: [ "8H", "9H", "10H", "JH", "QH", "KH" ] as CardId[],
	LS: [ "AS", "2S", "3S", "4S", "5S", "6S" ] as CardId[],
	US: [ "8S", "9S", "10S", "JS", "QS", "KS" ] as CardId[]
} as const;

/**
 * Returns the book for a given card in this variant, or `undefined` when the card
 * belongs to no book of that variant — a 7 in a CANADIAN game, whose deck has
 * none. Callers taking a card from client input MUST handle `undefined`; an
 * earlier `!` here turned a hostile `claimBook` into an uncaught throw.
 *
 * @param card - The card to find the book for
 * @param bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @returns The book containing the card, or `undefined` if this variant has none
 * @public
 */
export function getBookForCard( card: CardId, bookType: BookType ) {
	switch ( bookType ) {
		case "NORMAL":
			return Object.keys( NORMAL_BOOKS ).map( book => book as keyof typeof NORMAL_BOOKS )
				.find( book => NORMAL_BOOKS[ book ].includes( card ) );

		case "CANADIAN":
			return Object.keys( CANADIAN_BOOKS ).map( book => book as keyof typeof CANADIAN_BOOKS )
				.find( book => CANADIAN_BOOKS[ book ].includes( card ) );
	}
}

/**
 * Returns all books in a player's hand based on the book type.
 * @param hand - The player's hand of cards
 * @param bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @returns An array of unique books found in the hand
 * @public
 */
export function getBooksInHand( hand: readonly CardId[], bookType: BookType ) {
	const books = new Set<Book>(
		hand.map( cardId => getBookForCard( cardId, bookType ) )
			.filter( ( b ): b is NonNullable<typeof b> => !!b )
	);
	return Array.from( books );
}

/**
 * Returns the cards that are missing from a player's hand for a specific book.
 * @param hand - The player's hand of cards
 * @param book - The book to check for missing cards
 * @param bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @returns An array of card IDs that are missing from the hand for the specified book
 * @public
 */
export function getMissingCards( hand: readonly CardId[], book: Book, bookType: BookType ) {
	return bookType === "NORMAL"
		? NORMAL_BOOKS[ book as NormalBook ].filter( ( cardId ) => !hand.includes( cardId ) )
		: CANADIAN_BOOKS[ book as CanadianBook ].filter( ( cardId ) => !hand.includes( cardId ) );
}

/**
 * Returns the cards of a specific book, optionally filtered by the player's hand.
 * The two variants' book names are disjoint (`ACES`/`TWOS`... vs `LC`/`UD`...),
 * so the book itself identifies the variant — no `bookType` is needed, and none
 * has to be inferred from the cards still in play.
 *
 * @param book - The book to get cards from
 * @param hand - Optional player's hand of cards to filter the results
 * @returns The book's cards, filtered by the hand if provided; empty for an unknown book
 * @public
 */
export function getCardsOfBook( book: Book, hand?: readonly CardId[] ) {
	const cards: readonly CardId[] = NORMAL_BOOKS[ book as NormalBook ]
		?? CANADIAN_BOOKS[ book as CanadianBook ]
		?? [];

	return cards.filter( card => !hand || hand.includes( card ) );
}

const SUIT_SYMBOLS: Record<string, string> = { C: "♣", D: "♦", H: "♥", S: "♠" };

const CANADIAN_BOOK_DISPLAY: Record<CanadianBook, { label: string; suit: string }> = {
	LC: { label: "LOW", suit: "C" },
	LD: { label: "LOW", suit: "D" },
	LH: { label: "LOW", suit: "H" },
	LS: { label: "LOW", suit: "S" },
	UC: { label: "HIGH", suit: "C" },
	UD: { label: "HIGH", suit: "D" },
	UH: { label: "HIGH", suit: "H" },
	US: { label: "HIGH", suit: "S" }
};

/**
 * Return a human-readable display string for a book.
 *
 * @param book - The book to display.
 * @param bookType - The book type variant.
 * @returns A display string (e.g., "ACES" or "LOW ♣").
 */
export function getBookDisplayString( book: Book, bookType: BookType ) {
	if ( bookType === "NORMAL" ) {
		return book;
	}

	const info = CANADIAN_BOOK_DISPLAY[ book as CanadianBook ];
	return `${ info.label } ${ SUIT_SYMBOLS[ info.suit ] }`;
}

/**
 * Return the suit character for a Canadian book, or undefined for normal books.
 *
 * @param book - The book to check.
 * @param bookType - The book type variant.
 * @returns The suit character (e.g., "C"), or undefined.
 */
export function getBookSuit( book: Book, bookType: BookType ) {
	if ( bookType !== "CANADIAN" ) {
		return undefined;
	}
	return CANADIAN_BOOK_DISPLAY[ book as CanadianBook ]?.suit;
}

/**
 * Generate a human-readable description of an ask action.
 *
 * @param ask - The ask event to describe.
 * @param players - The player info records for name lookup.
 * @returns A description string like "Alice asked Bob for ACE OF HEARTS and got the card!".
 */
export function getAskDescription( ask: Ask, players: Record<PlayerId, PlayerInfo> ) {
	const askingPlayer = players[ ask.playerId ]?.name;
	const askedPlayer = players[ ask.from ]?.name;
	const cardString = getCardDisplayString( ask.cardId );
	const successString = ask.success ? "got the card!" : "was declined!";
	return `${ askingPlayer } asked ${ askedPlayer } for ${ cardString } and ${ successString }`;
}

/**
 * Generate a human-readable description of a claim action.
 *
 * @param claim - The claim event to describe.
 * @param players - The player info records for name lookup.
 * @param bookType - The book type variant for display formatting.
 * @returns A description string like "Alice declared ACES correctly!".
 */
export function getClaimDescription(
	claim: Claim,
	players: Record<PlayerId, PlayerInfo>,
	bookType: BookType
) {
	const successString = claim.success ? "correctly!" : "incorrectly!";
	const bookDisplay = getBookDisplayString( claim.book, bookType );
	return `${ players[ claim.playerId ]?.name } declared ${ bookDisplay } ${ successString }`;
}

/**
 * Generate a human-readable description of a turn transfer action.
 *
 * @param transfer - The transfer event to describe.
 * @param players - The player info records for name lookup.
 * @returns A description string like "Alice transferred the turn to Bob".
 */
export function getTransferDescription(
	transfer: Transfer,
	players: Record<PlayerId, PlayerInfo>
) {
	const transferringPlayer = players[ transfer.playerId ]?.name;
	const receivingPlayer = players[ transfer.transferTo ]?.name;
	return `${ transferringPlayer } transferred the turn to ${ receivingPlayer }`;
}

/**
 * How many sides a given seat count may be played in. Swish sides are equal-sized,
 * so only a count that divides the seats evenly can be seated at all — `initialize`
 * refuses the rest with `InvalidTeamConfig`, and this is what a client offers so the
 * refusal never has to happen.
 *
 * @param playerCount - How many seats the table has
 * @returns The team counts that divide those seats evenly
 */
export function teamCountsFor( playerCount: PlayerCount ) {
	return TeamCount.literals.filter( count => playerCount % count === 0 );
}

/**
 * Everything a fish table knows out loud: what has happened and how many cards
 * each seat is holding. Both `FishState` and `FishView` satisfy it, which is the
 * point — every derivation below runs the same on the server's record and on a
 * client's view, so nobody has to reimplement the table's reasoning.
 */
export type PublicKnowledge = {
	readonly cardCounts: Readonly<Record<PlayerId, number>>;
	readonly moves: readonly FishMove[];
};

/**
 * The declarations out of a table's history, oldest first.
 *
 * @param known - The table's public knowledge.
 * @returns Every declaration, in the order they were made.
 */
export const claimsOf = ( known: PublicKnowledge ) =>
	known.moves.filter( ( move ): move is Claim => move._tag === "fish/Claim" );

/**
 * The side a declared book goes to.
 *
 * A correct declaration wins the book for the declaring side. A wrong one loses it
 * to an opposing side — the one holding the most of the book's cards, per where
 * they really were, with ties and a book that was entirely inside the declaring
 * side both falling to the first opposing side in seat order.
 *
 * It is derived rather than stored so the answer cannot drift from the claim it
 * came from: `success`, the declarer and `correctClaim` are all recorded on the
 * event, and membership is fixed at `start` and unreachable by undo, so a rebuild
 * from the log lands on the same side every time.
 *
 * @param claim - The declaration being scored
 * @param context - The context holding membership and the seating order
 * @returns The side that won the book, or `undefined` in a game without sides
 */
export function getBookWinner( claim: Claim, context: GameContext ) {
	const declarer = context.teams[ claim.playerId ];
	if ( claim.success ) {
		return declarer;
	}

	const holders = Object.values( claim.correctClaim );
	const held = new Map<TeamId, number>();

	for ( const playerId of context.players ) {
		const team = context.teams[ playerId ];
		if ( team === undefined || team === declarer ) {
			continue;
		}

		const count = holders.filter( holder => holder === playerId ).length;
		held.set( team, ( held.get( team ) ?? 0 ) + count );
	}

	let winner: TeamId | undefined;
	let best = -1;

	for ( const [ team, count ] of held ) {
		if ( count > best ) {
			best = count;
			winner = team;
		}
	}

	return winner;
}

/**
 * How many books each side has won so far. Folded from the declarations rather
 * than held in the state, since every declaration takes its book out of play and
 * `getBookWinner` says where it went.
 *
 * @param claims - The declarations made so far, in the order they happened
 * @param context - The context holding membership and the seating order
 * @param teams - The sides the config declares
 * @returns Books won, one entry per side, zero for a side that has won none
 */
export function getTeamScores(
	claims: readonly Claim[],
	context: GameContext,
	teams: readonly TeamId[]
) {
	const scores = Object.fromEntries(
		teams.map( team => [ team, 0 ] )
	) as Record<TeamId, number>;

	for ( const claim of claims ) {
		const winner = getBookWinner( claim, context );
		if ( winner !== undefined && winner in scores ) {
			scores[ winner ] = ( scores[ winner ] ?? 0 ) + 1;
		}
	}

	return scores;
}

/**
 * Whether a seat may hand its turn to a teammate.
 *
 * Legal only directly after that seat's own successful declaration — the reward
 * for getting one right is the choice of who plays next on your side, and it
 * expires the moment anything else happens. Reading the *last* move is what makes
 * it expire: the declaration stays in the history for the rest of the game, so
 * asking whether it is in there at all would let a seat transfer long after.
 *
 * Both `FishState` and `FishView` carry the history this reads, so the client
 * offers the move on exactly the condition the engine's `validate` allows it.
 *
 * @param known - The table's public knowledge.
 * @param playerId - The seat being asked about.
 * @returns `true` when that seat is holding a fresh successful declaration.
 */
export function canTransferTurn( known: PublicKnowledge, playerId: PlayerId ) {
	const last = known.moves.at( -1 );
	return last?._tag === "fish/Claim"
		&& last.success
		&& last.playerId === playerId;
}

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
		botDelayMillis: FISH_BOT_DELAY_MILLIS,
		moveTimeoutMillis: FISH_MOVE_TIMEOUT_MILLIS
	};
}


// --- Reading the table ------------------------------------------------------

/**
 * The move that just happened, when it was a declaration.
 *
 * Every gate below reads the tail of `state.moves` rather than a field of its
 * own. The history is already the complete record of what a seat last did, and
 * `FishState` deliberately keeps no second copy of it — one that had to be kept
 * in step by hand is exactly the thing that drifts.
 *
 * @param state - The table as the engine holds it.
 * @returns The declaration that just landed, or `undefined` for anything else.
 */
export const lastClaim = ( state: FishState ) => {
	const last = state.moves.at( -1 );
	return last?._tag === "fish/Claim" ? last : undefined;
};

/**
 * The ask that just happened, if the last thing to happen was one.
 *
 * @param state - The table as the engine holds it.
 * @returns The ask that just landed, or `undefined` for anything else.
 */
export const lastAsk = ( state: FishState ) => {
	const last = state.moves.at( -1 );
	return last?._tag === "fish/Ask" ? last : undefined;
};

/**
 * The transfer that just happened, if the last thing to happen was one.
 *
 * @param state - The table as the engine holds it.
 * @returns The transfer that just landed, or `undefined` for anything else.
 */
export const lastTransfer = ( state: FishState ) => {
	const last = state.moves.at( -1 );
	return last?._tag === "fish/Transfer" ? last : undefined;
};

/**
 * Who is holding a card right now. Every card of a live book is in somebody's
 * hand — the deal is the whole deck and cards only ever move between seats — so
 * this answers for any card whose book has not been declared.
 *
 * @param hands - Every seat's cards.
 * @param card - The card being looked for.
 * @returns The seat holding it, or `undefined` once its book is out of play.
 */
export const holderOf = ( hands: FishState[ "hands" ], card: CardId ) =>
	( Object.keys( hands ) as PlayerId[] ).find( playerId => hands[ playerId ]?.includes( card ) );

/**
 * The next seat round the table, after `from`, that still holds cards — and that
 * the caller is willing to accept.
 *
 * A seat out of cards can do nothing at all: it may not ask (an ask needs a card
 * of the book being asked in) and it may not declare (a declaration needs one
 * too). Handing it the turn would stall the table for good. So the fish turn
 * order skips them, which is what the engine's own round-robin cannot do —
 * hence this game resolving its own turns rather than leaning on the default.
 *
 * @param context - The context holding the seating order.
 * @param cardCounts - How many cards each seat holds.
 * @param from - The seat the search starts after.
 * @param accept - An extra condition on the seat, defaulting to none.
 * @returns The seat to play next, or `undefined` when nobody qualifies.
 */
export const nextHolder = (
	context: GameContext,
	cardCounts: FishState[ "cardCounts" ],
	from: PlayerId,
	accept: ( candidate: PlayerId ) => boolean = () => true
) => {
	const order = context.players;
	const seat = order.indexOf( from );

	for ( let step = 1; step <= order.length; step++ ) {
		const candidate = order[ ( seat + step ) % order.length ]!;
		if ( ( cardCounts[ candidate ] ?? 0 ) > 0 && accept( candidate ) ) {
			return candidate;
		}
	}

	return undefined;
};

/**
 * The book a declaration is about, when the declaration is well formed.
 *
 * A claim is a map of card → holder and names no book of its own, because a book
 * that disagreed with the cards listed under it would be two statements where
 * there should be one. The book is read back off the cards instead: they must be
 * exactly one book's worth, all of it, and nothing else. Anything else — a card
 * this variant does not deal, a book half listed, a stray key — is not a losing
 * declaration, it is a malformed one.
 *
 * @param claim - The card → holder map the seat declared.
 * @param type - Which variant is being played.
 * @returns The book being declared, or `undefined` when the map is not one.
 */
export const bookOfClaim = ( claim: ClaimBookInput[ "claim" ], type: BookType ) => {
	const cards = Object.keys( claim ) as CardId[];
	const book = cards.length > 0 ? getBookForCard( cards[ 0 ]!, type ) : undefined;
	if ( !book ) {
		return undefined;
	}

	const expected = getCardsOfBook( book );
	return expected.length === cards.length && expected.every( card => !!claim[ card ] )
		? book
		: undefined;
};

/**
 * The config a table is actually created with, from the three things a client
 * chooses.
 *
 * `buildConfig` derives everything else — the deck, the books, how big a book
 * is, the sides' ids. The fields are picked out one by one rather than spread,
 * because it returns more than `FishConfig` declares and an extra key would
 * travel all the way to the archive, where the config is encoded as JSON.
 *
 * @param playerCount - Seats at the table.
 * @param type - Which variant is being played.
 * @param teamCount - How many sides to split the seats between.
 * @returns The complete config.
 */
export const fishConfigFor = (
	playerCount: PlayerCount,
	type: BookType,
	teamCount: TeamCount
) => {
	const derived = buildConfig( playerCount, type, teamCount );

	return FishConfig.make( {
		playerCount: derived.playerCount,
		type: derived.type,
		teams: derived.teams,
		deckType: derived.deckType,
		books: derived.books,
		bookSize: derived.bookSize,
		autoStart: derived.autoStart,
		botDelayMillis: derived.botDelayMillis,
		moveTimeoutMillis: derived.moveTimeoutMillis
	} );
};
