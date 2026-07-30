import type { CardId } from "@s2h/schema/cards";
import type { Ask, Book, BookType, Claim, FishState, Team, Transfer } from "@s2h/schema/fish";
import type { PlayerId, PlayerInfo } from "@s2h/schema/swish";
import { getCardDisplayString } from "./cards.ts";

/** Normal book names representing card ranks (all four suits per rank). */
export type NormalBook =
	"ACES"
	| "TWOS"
	| "THREES"
	| "FOURS"
	| "FIVES"
	| "SIXES"
	| "SEVENS"
	| "EIGHTS"
	| "NINES"
	| "TENS"
	| "JACKS"
	| "QUEENS"
	| "KINGS";

/** Canadian book names representing suit halves (L=low A-6, U=high 8-K). */
export type CanadianBook = "LC" | "LD" | "LH" | "LS" | "UC" | "UD" | "UH" | "US";

/** Supported player counts for Fish games. */
export type PlayerCount = 4 | 6 | 8;

/** Supported team counts for Fish games. */
export type TeamCount = 2 | 3 | 4;

/** Unique identifier for a team. */
export type TeamId = string;

/** Map of team IDs to team objects. */
export type TeamData = Record<TeamId, Team>;

/** Mapping of normal book names to their card IDs (4 cards per book, grouped by rank). */
export const NORMAL_BOOKS = {
	"ACES": [ "AC", "AD", "AH", "AS" ] as CardId[],
	"TWOS": [ "2C", "2D", "2H", "2S" ] as CardId[],
	"THREES": [ "3C", "3D", "3H", "3S" ] as CardId[],
	"FOURS": [ "4C", "4D", "4H", "4S" ] as CardId[],
	"FIVES": [ "5C", "5D", "5H", "5S" ] as CardId[],
	"SIXES": [ "6C", "6D", "6H", "6S" ] as CardId[],
	"SEVENS": [ "7C", "7D", "7H", "7S" ] as CardId[],
	"EIGHTS": [ "8C", "8D", "8H", "8S" ] as CardId[],
	"NINES": [ "9C", "9D", "9H", "9S" ] as CardId[],
	"TENS": [ "10C", "10D", "10H", "10S" ] as CardId[],
	"JACKS": [ "JC", "JD", "JH", "JS" ] as CardId[],
	"QUEENS": [ "QC", "QD", "QH", "QS" ] as CardId[],
	"KINGS": [ "KC", "KD", "KH", "KS" ] as CardId[]
} as const;

/** Mapping of Canadian book names to their card IDs (6 cards per book, grouped by suit half). */
export const CANADIAN_BOOKS = {
	"LC": [ "AC", "2C", "3C", "4C", "5C", "6C" ] as CardId[],
	"LD": [ "AD", "2D", "3D", "4D", "5D", "6D" ] as CardId[],
	"UC": [ "8C", "9C", "10C", "JC", "QC", "KC" ] as CardId[],
	"UD": [ "8D", "9D", "10D", "JD", "QD", "KD" ] as CardId[],
	"LH": [ "AH", "2H", "3H", "4H", "5H", "6H" ] as CardId[],
	"UH": [ "8H", "9H", "10H", "JH", "QH", "KH" ] as CardId[],
	"LS": [ "AS", "2S", "3S", "4S", "5S", "6S" ] as CardId[],
	"US": [ "8S", "9S", "10S", "JS", "QS", "KS" ] as CardId[]
} as const;

/**
 * Returns the book for a given card based on the book type.
 * @param card - The card to find the book for
 * @param bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @returns The book that contains the card
 * @public
 */
export function getBookForCard( card: CardId, bookType: BookType ) {
	switch ( bookType ) {
		case "NORMAL":
			return Object.keys( NORMAL_BOOKS ).map( book => book as keyof typeof NORMAL_BOOKS )
				.find( book => NORMAL_BOOKS[ book ].includes( card ) )!;

		case "CANADIAN":
			return Object.keys( CANADIAN_BOOKS ).map( book => book as keyof typeof CANADIAN_BOOKS )
				.find( book => CANADIAN_BOOKS[ book ].includes( card ) )!;
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
	const books = new Set<Book>( hand.map( cardId => getBookForCard( cardId, bookType ) ) );
	return Array.from( books );
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
 * @param book - The book to get cards from
 * @param bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @param hand - Optional player's hand of cards to filter the results
 * @returns An array of PlayingCards from the specified book, filtered by the hand if provided
 * @public
 */
export function getCardsOfBook( book: Book, bookType: BookType, hand?: readonly CardId[] ) {
	const cards = bookType === "NORMAL"
		? NORMAL_BOOKS[ book as NormalBook ]
		: CANADIAN_BOOKS[ book as CanadianBook ];

	return cards.filter( card => !hand || hand.includes( card ) );
}

/**
 * Return the team ID that a player belongs to.
 *
 * @param teams - The team data mapping team IDs to team info.
 * @param playerId - The player to look up.
 * @returns The team ID the player belongs to.
 */
export function getTeamForPlayer( teams: TeamData, playerId: PlayerId ): TeamId {
	return Object.keys( teams )
		.find( tid => ( teams[ tid ]?.members ?? [] ).includes( playerId ) )!;
}

/**
 * Return all players on opposing teams.
 *
 * @param teams - The team data mapping team IDs to team info.
 * @param playerId - The player whose opponents to find.
 * @returns An array of opponent player IDs.
 */
export function getOpponents( teams: TeamData, playerId: PlayerId ): PlayerId[] {
	const teamId = getTeamForPlayer( teams, playerId );
	return Object.keys( teams )
		.filter( tid => tid !== teamId )
		.flatMap( tid => teams[ tid ]?.members ?? [] );
}

/**
 * Return all teammates of a player, excluding the player themselves.
 *
 * @param teams - The team data mapping team IDs to team info.
 * @param playerId - The player whose teammates to find.
 * @returns An array of teammate player IDs.
 */
export function getTeammates( teams: TeamData, playerId: PlayerId ): PlayerId[] {
	const teamId = getTeamForPlayer( teams, playerId );
	return ( teams[ teamId ]?.members ?? [] ).filter( pid => pid !== playerId );
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
export function getBookDisplayString( book: Book, bookType: BookType ): string {
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
export function getBookSuit( book: Book, bookType: BookType ): string | undefined {
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
 * Return all books that have been claimed across all teams.
 *
 * @param state - The game state.
 * @returns An array of claimed book names.
 */
export function getClaimedBooks( state: FishState ): Book[] {
	return Object.values( state.teams ).flatMap( s => s.booksWon );
}

/**
 * Build a FishConfig object from create game input parameters.
 * Determines book type, deck size, and book definitions based on the game variant.
 *
 * @param playerCount No of players
 * @param type Book Type for the game
 * @param teamCount No of teams
 * @returns A complete FishConfig object.
 */
export function buildConfig( playerCount: PlayerCount, type: BookType, teamCount: TeamCount ) {
	const isCanadian = type === "CANADIAN";
	const books = ( isCanadian
		? Object.keys( CANADIAN_BOOKS )
		: Object.keys( NORMAL_BOOKS ) ) as Book[];

	return {
		type,
		playerCount,
		teamCount,
		deckType: isCanadian ? 48 as const : 52 as const,
		books,
		bookSize: isCanadian ? 6 as const : 4 as const,
		autoStart: true
	};
}