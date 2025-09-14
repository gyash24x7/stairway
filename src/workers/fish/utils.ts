import type { CardId, PlayingCard } from "@/utils/cards";
import { getCardFromId, getCardId, isCardInHand } from "@/utils/cards";
import type { Book, BookType, CanadianBook, NormalBook } from "@/workers/fish/types";

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

export const GAME_STATUS = {
	CREATED: "CREATED",
	PLAYERS_READY: "PLAYERS_READY",
	TEAMS_CREATED: "TEAMS_CREATED",
	IN_PROGRESS: "IN_PROGRESS",
	COMPLETED: "COMPLETED"
} as const;

/**
 * Returns the book for a given card based on the book type.
 * @param {PlayingCard | CardId} card - The card to find the book for
 * @param {BookType} bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @returns {Book} The book that contains the card
 */
export function getBookForCard( card: PlayingCard | CardId, bookType: BookType ): Book {
	if ( typeof card !== "string" ) {
		card = getCardId( card );
	}

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
 * @param {PlayingCard[]} hand - The player's hand of cards
 * @param {BookType} bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @returns {Book[]} An array of unique books found in the hand
 */
export function getBooksInHand( hand: PlayingCard[], bookType: BookType ): Book[] {
	const books = new Set<Book>( hand.map( getCardId ).map( cardId => getBookForCard( cardId, bookType ) ) );
	return Array.from( books );
}

/**
 * Checks if a specific book is present in a player's hand.
 * @param {PlayingCard[]} hand - The player's hand of cards
 * @param {Book} book - The book to check for
 * @param {BookType} bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @returns {boolean} True if the book is in hand, false otherwise
 */
export function isBookInHand( hand: PlayingCard[], book: Book, bookType: BookType ): boolean {
	return getBooksInHand( hand, bookType ).includes( book );
}

/**
 * Returns the cards that are missing from a player's hand for a specific book.
 * @param {PlayingCard[]} hand - The player's hand of cards
 * @param {Book} book - The book to check for missing cards
 * @param {BookType} bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @returns {CardId[]} An array of card IDs that are missing from the hand for the specified book
 */
export function getMissingCards( hand: PlayingCard[], book: Book, bookType: BookType ): CardId[] {
	return bookType === "NORMAL"
		? NORMAL_BOOKS[ book as NormalBook ].filter( ( cardId ) => !isCardInHand( hand, cardId ) )
		: CANADIAN_BOOKS[ book as CanadianBook ].filter( ( cardId ) => !isCardInHand( hand, cardId ) );
}

/**
 * Returns the cards of a specific book, optionally filtered by the player's hand.
 * @param {Book} book - The book to get cards from
 * @param {BookType} bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @param {PlayingCard[]} hand - Optional player's hand of cards to filter the results
 * @returns {PlayingCard[]} An array of PlayingCard objects from the specified book, filtered by the hand if provided
 */
export function getCardsOfBook( book: Book, bookType: BookType, hand?: PlayingCard[] ): PlayingCard[] {
	const cards = bookType === "NORMAL"
		? NORMAL_BOOKS[ book as NormalBook ]
		: CANADIAN_BOOKS[ book as CanadianBook ];

	return cards.filter( card => !hand || isCardInHand( hand, card ) ).map( getCardFromId );
}