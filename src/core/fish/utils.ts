import type { CardId, PlayingCard } from "@/core/cards/types";
import { getCardFromId, getCardId, isCardInHand } from "@/core/cards/utils";
import { CANADIAN_BOOKS, NORMAL_BOOKS } from "@/core/fish/constants";
import type { Book, BookType, CanadianBook, NormalBook } from "@/core/fish/schema";

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