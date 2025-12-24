import { type CardId } from "@s2h/utils/cards";
import { generateGameCode, generateId } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import type {
	Book,
	BookType,
	CanadianBook,
	Metrics,
	NormalBook,
	PlayerGameInfo,
	PlayerId,
	WeightedAsk,
	WeightedBook,
	WeightedClaim,
	WeightedTransfer
} from "./types.ts";

const logger = createLogger( "Fish:Utils" );

const MAX_WEIGHT = 720;

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

export const DEFAULT_METRICS: Metrics = {
	totalAsks: 0,
	cardsTaken: 0,
	cardsGiven: 0,
	totalClaims: 0,
	successfulClaims: 0
};

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
export function getBooksInHand( hand: CardId[], bookType: BookType ) {
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
export function isBookInHand( hand: CardId[], book: Book, bookType: BookType ) {
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
export function getMissingCards( hand: CardId[], book: Book, bookType: BookType ) {
	return bookType === "NORMAL"
		? NORMAL_BOOKS[ book as NormalBook ].filter( ( cardId ) => !hand.includes( cardId ) )
		: CANADIAN_BOOKS[ book as CanadianBook ].filter( ( cardId ) => !hand.includes( cardId ) );
}

/**
 * Returns the cards of a specific book, optionally filtered by the player's hand.
 * @param book - The book to get cards from
 * @param bookType - The type of book to search in, either "NORMAL" or "CANADIAN"
 * @param hand - Optional player's hand of cards to filter the results
 * @returns An array of PlayingCard objects from the specified book, filtered by the hand if provided
 * @public
 */
export function getCardsOfBook( book: Book, bookType: BookType, hand?: CardId[] ) {
	const cards = bookType === "NORMAL"
		? NORMAL_BOOKS[ book as NormalBook ]
		: CANADIAN_BOOKS[ book as CanadianBook ];

	return cards.filter( card => !hand || hand.includes( card ) );
}

/**
 * Create a fresh default GameData object.Returns a fully-initialized,
 * deterministic data shape used as the engine's starting state.
 * @returns a new default game data object (id, code, empty structures).
 * @public
 */
export function getDefaultGameData() {
	return {
		id: generateId(),
		code: generateGameCode(),
		status: GAME_STATUS.CREATED,
		currentTurn: "",
		createdBy: "",
		config: {
			type: "NORMAL" as const,
			playerCount: 6 as const,
			teamCount: 2 as const,
			books: [],
			deckType: 48 as const,
			bookSize: 4 as const
		},

		playerIds: [],
		players: {},

		teamIds: [],
		teams: {},

		hands: {},
		cardCounts: {},
		cardMappings: {},
		cardLocations: {},

		askHistory: [],
		claimHistory: [],
		transferHistory: [],
		metrics: {}
	};
}

/**
 * Suggests books to the player based on their hand and known card locations.
 * Logic for weighting books:
 * - Each card in the book that the player has in hand adds maximum weight.
 * - Each card with a known owner adds maximum weight.
 * - Each card with possible owners adds weight inversely proportional to the number of possible owners.
 * - Books that have all cards known or in hand with team members are marked as being with the team.
 * - Books that can be fully claimed (all cards known or in hand) are marked as claimable.
 * - Books with the team cannot be claimed if don't know the exact owners of all cards.
 *
 * @param data - The player's game info including hand, players, card locations, and config.
 * @returns sorted list of weighted book suggestions.
 * @public
 */
export function suggestBooks( { playerId, hand, players, cardLocations, config }: PlayerGameInfo ) {
	logger.debug( ">> suggestBooks()" );

	const booksInGame = new Set( Object.keys( cardLocations ).map( k => getBookForCard( k as CardId, config.type ) ) );
	const booksInHand = getBooksInHand( hand, config.type );
	const validBooks = Array.from( booksInGame ).filter( book => booksInHand.includes( book ) );
	const { teamMates } = players[ playerId ];
	const weightedBooks: WeightedBook[] = [];

	for ( const book of validBooks ) {

		const weightedBook = { book, weight: 0, isBookWithTeam: true, isClaimable: true, isKnown: true };
		const cardsInBook = getCardsOfBook( book, config.type );

		for ( const cardId of cardsInBook ) {
			const possibleOwners = cardLocations[ cardId ]!;

			if ( hand.includes( cardId ) ) {
				weightedBook.weight += MAX_WEIGHT;
				continue;
			}

			const isCardLocationKnown = possibleOwners.length === 1;
			const isCardWithTeam = possibleOwners.every( pid => teamMates.includes( pid ) );

			weightedBook.weight += MAX_WEIGHT / possibleOwners.length;
			weightedBook.isKnown = weightedBook.isKnown && isCardLocationKnown;
			weightedBook.isBookWithTeam = weightedBook.isBookWithTeam && isCardWithTeam;
			weightedBook.isClaimable = weightedBook.isClaimable && weightedBook.isKnown && isCardLocationKnown;
		}

		weightedBooks.push( { ...weightedBook, weight: weightedBook.weight / cardsInBook.length } );
	}

	logger.debug( "<< suggestBooks()" );
	return weightedBooks
		.filter( a => a.weight > 0 )
		.toSorted( ( a, b ) => b.weight - a.weight );
}

/**
 * Suggest ask proposals for missing cards in the given books.
 * Logic for weighting asks:
 * - If the card has a known owner who is not on the player's team, assign maximum weight.
 * - If the card has possible owners not on the player's team, distribute weight equally among them.
 *
 * @param books weighted book suggestions to consider.
 * @param data - The player's game info including hand, players, card locations, and config.
 * @returns ordered list of weighted ask proposals.
 * @public
 */
export function suggestAsks(
	books: WeightedBook[],
	{ playerId, hand, players, cardLocations, config, cardCounts }: PlayerGameInfo
) {
	logger.debug( ">> suggestAsks()" );

	const { teamMates } = players[ playerId ];
	const weightedAsks: WeightedAsk[] = [];

	for ( const { book } of books ) {
		const missingCards = getMissingCards( hand, book, config.type );
		const asksForBook: WeightedAsk[] = [];

		for ( const cardId of missingCards ) {
			const possibleOwners = cardLocations[ cardId ]!;
			for ( const pid of possibleOwners ) {
				if ( pid !== playerId && !teamMates.includes( pid ) && cardCounts[ pid ] > 0 ) {
					asksForBook.push( { playerId: pid, cardId, weight: MAX_WEIGHT / possibleOwners.length } );
				}
			}
		}

		weightedAsks.push( ...asksForBook.toSorted( ( a, b ) => b.weight - a.weight ) );
	}

	logger.debug( "<< suggestAsks()" );
	return weightedAsks;
}

/**
 * Suggest claim proposals for fully known books.
 * Logic for weighting claims:
 * - Each card in the book with a known owner adds maximum weight.
 * - A claim is only viable if all cards in the book have known owners.
 *
 * @param books weighted book suggestions to consider.
 * @param data - The player's game info including hand, players, card locations, and config.
 * @returns list of viable claims ordered by confidence weight.
 * @public
 */
export function suggestClaims( books: WeightedBook[], { cardLocations, config }: PlayerGameInfo ) {
	logger.debug( ">> suggestClaims()" );

	const validBooks = books.filter( book => book.isClaimable && book.isBookWithTeam );
	const claims: WeightedClaim[] = [];

	for ( const { book } of validBooks ) {
		let weight = 0;
		const claim = {} as Record<CardId, PlayerId>;
		const cardsInBook = getCardsOfBook( book, config.type );

		for ( const cardId of cardsInBook ) {
			const possibleOwners = cardLocations[ cardId ]!;

			if ( possibleOwners.length === 1 ) {
				weight += MAX_WEIGHT;
				claim[ cardId ] = possibleOwners[ 0 ];
			}
		}

		if ( Object.keys( claim ).length === cardsInBook.length ) {
			claims.push( { book, claim, weight: weight / cardsInBook.length } );
		}
	}

	logger.debug( "<< suggestClaims()" );
	return claims.sort( ( a, b ) => b.weight - a.weight );
}

/**
 * Suggest risky claim proposals for books that are with the team but not fully known.
 * Logic for weighting claims:
 * - Each card in the book with a known owner adds maximum weight.
 * - Each card with possible owners adds weight inversely proportional to the number of possible owners.
 * - A claim is generated for all combinations of possible owners for the cards in the book.
 *
 * @param books weighted book suggestions to consider.
 * @param data - The player's game info including hand, players, card locations, and config.
 * @returns list of risky claims ordered by confidence weight.
 * @public
 */
export function suggestRiskyClaims( books: WeightedBook[], { cardLocations, config }: PlayerGameInfo ) {
	logger.debug( ">> suggestRiskyClaims()" );

	const validBooks = books.filter( book => book.isBookWithTeam && !book.isClaimable );
	const claims: WeightedClaim[] = [];

	for ( const { book } of validBooks ) {
		const cardsInBook = getCardsOfBook( book, config.type );
		const possibleOwners: Partial<Record<CardId, PlayerId[]>> = {};

		for ( const cardId of cardsInBook ) {
			possibleOwners[ cardId ] = cardLocations[ cardId ]!;
		}

		const generateClaims = ( index: number, currentClaim: Partial<Record<CardId, PlayerId>> ) => {
			if ( index === cardsInBook.length ) {
				let weight = 0;
				for ( const cardId of cardsInBook ) {
					const owners = possibleOwners[ cardId ];
					if ( owners!.length === 1 ) {
						weight += MAX_WEIGHT;
					} else {
						weight += MAX_WEIGHT / owners!.length;
					}
				}
				claims.push( { book, claim: { ...currentClaim }, weight: weight / cardsInBook.length } );
				return;
			}

			const cardId = cardsInBook[ index ];
			for ( const owner of possibleOwners[ cardId ]! ) {
				currentClaim[ cardId ] = owner;
				generateClaims( index + 1, currentClaim );
				delete currentClaim[ cardId ];
			}
		};

		generateClaims( 0, {} );
	}

	logger.debug( "<< suggestRiskyClaims()" );
	return claims.sort( ( a, b ) => b.weight - a.weight );
}

/**
 * Suggest transfer targets for cards in known books.
 * Logic for weighting transfers:
 * - Each card in the book that is known to be with a team member adds maximum weight to that member.
 *
 * @param data - The player's game info including hand, players, card locations, and config.
 * @returns sorted list of transfer recommendations.
 * @public
 */
export function suggestTransfers( { playerId, players, cardLocations, config }: PlayerGameInfo ) {
	logger.debug( ">> suggestTransfers()" );

	const { teamMates } = players[ playerId ];
	const validBooks = new Set( Object.keys( cardLocations ).map( k => getBookForCard( k as CardId, config.type ) ) );
	const weightedTransfers = {} as Record<PlayerId, number>;

	for ( const book of validBooks ) {
		const cardsInBook = getCardsOfBook( book, config.type );
		for ( const cardId of cardsInBook ) {
			const possibleOwners = cardLocations[ cardId ];
			if ( !possibleOwners ) {
				continue;
			}

			if ( possibleOwners.length === 1 && teamMates.includes( possibleOwners[ 0 ] ) ) {
				weightedTransfers[ possibleOwners[ 0 ] ] =
					( weightedTransfers[ possibleOwners[ 0 ] ] ?? 0 ) + MAX_WEIGHT;
			}
		}
	}

	const transfers: WeightedTransfer[] = Object.entries( weightedTransfers )
		.map( ( [ transferTo, weight ] ) => ( { transferTo, weight } ) )
		.toSorted( ( a, b ) => b.weight - a.weight );

	logger.debug( "<< suggestTransfers()" );
	return transfers;
}