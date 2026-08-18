import { TeamCount } from "@/games/fish/shared/schema.ts";
import { getCardDisplayString } from "@/shared/cards/utils.ts";
import { teamOf } from "@/swish/shared/teams.ts";

import type {
	Ask,
	Book,
	BookType,
	CanadianBook,
	Claim,
	FishMove,
	NormalBook,
	PlayerCount,
	Transfer
} from "@/games/fish/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { GameContext, PlayerId, PlayerInfo, TeamId } from "@/swish/shared/schema.ts";


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
	const askingPlayer = players[ ask.playerId ].name;
	const askedPlayer = players[ ask.from ].name;
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
	return `${ players[ claim.playerId ].name } declared ${ bookDisplay } ${ successString }`;
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
	const transferringPlayer = players[ transfer.playerId ].name;
	const receivingPlayer = players[ transfer.transferTo ].name;
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
	const declarer = teamOf( context, claim.playerId );
	if ( claim.success ) {
		return declarer;
	}

	const holders = Object.values( claim.correctClaim );
	const held = new Map<TeamId, number>();

	for ( const playerId of context.players ) {
		const team = teamOf( context, playerId );
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
			scores[ winner ] += 1;
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
