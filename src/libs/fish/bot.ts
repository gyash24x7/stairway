import type { CardId } from "@/libs/cards/types";
import { isCardInHand } from "@/libs/cards/utils";
import type {
	FishBook,
	FishPlayerGameInfo,
	PlayerId,
	WeightedAsk,
	WeightedBook,
	WeightedClaim
} from "@/libs/fish/types";
import { getBooksInHand, getMissingCards } from "@/libs/fish/utils";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger( "Fish:Bot" );
const MAX_WEIGHT = 720;

export function suggestBooks( { playerId, hand, players, bookStates, config }: FishPlayerGameInfo ) {
	logger.debug( ">> suggestBooks()" );

	const validBooks = config.books.filter( book => !!bookStates[ book ] );
	const currentPlayer = players[ playerId ];
	const weightedBooks: WeightedBook[] = [];

	for ( const book of validBooks ) {

		const weightedBook = { book, weight: 0, isBookWithTeam: true, isClaimable: true, isKnown: true };
		const state = bookStates[ book ];

		for ( const cardId of state.cards ) {

			if ( isCardInHand( hand, cardId ) ) {
				weightedBook.weight += MAX_WEIGHT;
				continue;
			}

			if ( state.knownOwners[ cardId ] ) {
				weightedBook.weight += MAX_WEIGHT;
				if ( !currentPlayer.teamMates.includes( state.knownOwners[ cardId ] ) ) {
					weightedBook.isBookWithTeam = false;
					weightedBook.isClaimable = false;
				}
				continue;
			}

			if ( state.inferredOwners[ cardId ] ) {
				weightedBook.weight += MAX_WEIGHT / 2;
				if ( !currentPlayer.teamMates.includes( state.inferredOwners[ cardId ] ) ) {
					weightedBook.isBookWithTeam = false;
					weightedBook.isClaimable = false;
				}
				continue;
			}

			if ( state.possibleOwners[ cardId ].length > 0 ) {
				weightedBook.isKnown = false;
				weightedBook.isClaimable = false;
				weightedBook.weight += MAX_WEIGHT / state.possibleOwners[ cardId ].length;

				if ( !state.possibleOwners[ cardId ].every( pid => currentPlayer.teamMates.includes( pid ) ) ) {
					weightedBook.isBookWithTeam = false;
				}
			}

			if ( !getBooksInHand( hand, config.type ).includes( book ) ) {
				weightedBook.isClaimable = false;
			}
		}

		weightedBooks.push( { ...weightedBook, weight: weightedBook.weight / state.cards.length } );
	}

	logger.debug( "<< suggestBooks()" );
	return weightedBooks.toSorted( ( a, b ) => b.weight - a.weight );
}

export function suggestAsks( books: FishBook[], { playerId, hand, players, bookStates, config }: FishPlayerGameInfo ) {
	logger.debug( ">> suggestAsks()" );

	const currentPlayer = players[ playerId ];
	const weightedAsks: WeightedAsk[] = [];

	for ( const book of books ) {
		const missingCards = getMissingCards( hand, book, config.type );
		const asksForBook: WeightedAsk[] = [];
		for ( const cardId of missingCards ) {
			const knownOwner = bookStates[ book ].knownOwners[ cardId ];
			const possibleOwners = bookStates[ book ].possibleOwners[ cardId ];

			if ( knownOwner !== playerId && !currentPlayer.teamMates.includes( knownOwner ) ) {
				asksForBook.push( { playerId: knownOwner, cardId, weight: MAX_WEIGHT } );
			} else {
				for ( const pid of possibleOwners ) {
					if ( pid !== playerId && !currentPlayer.teamMates.includes( pid ) ) {
						asksForBook.push( { playerId: pid, cardId, weight: MAX_WEIGHT / possibleOwners.length } );
					}
				}
			}
		}

		weightedAsks.push( ...asksForBook.toSorted( ( a, b ) => b.weight - a.weight ) );
	}

	logger.debug( "<< suggestAsks()" );
	return weightedAsks;
}

export function suggestClaims( books: WeightedBook[], { bookStates }: FishPlayerGameInfo ) {
	logger.debug( ">> suggestClaims()" );

	const validBooks = books.filter( book => book.isClaimable && book.isBookWithTeam );
	const claims: WeightedClaim[] = [];

	for ( const { book } of validBooks ) {
		const state = bookStates[ book ];
		let weight = 0;
		const claim = {} as Record<CardId, PlayerId>;

		for ( const cardId of state.cards ) {
			if ( state.knownOwners[ cardId ] ) {
				weight += MAX_WEIGHT;
				claim[ cardId ] = state.knownOwners[ cardId ];
			} else if ( state.inferredOwners[ cardId ] ) {
				weight += MAX_WEIGHT / 2;
				claim[ cardId ] = state.inferredOwners[ cardId ];
			}
		}

		if ( Object.keys( claim ).length === bookStates[ book ].cards.length ) {
			claims.push( { book, claim, weight } );
		}
	}

	logger.debug( "<< suggestClaims()" );
	return claims.sort( ( a, b ) => b.weight - a.weight );
}

export function suggestTransfers( books: WeightedBook[], { playerId, players, bookStates }: FishPlayerGameInfo ) {
	logger.debug( ">> suggestTransfers()" );

	const currentPlayer = players[ playerId ];
	const validBooks = books.filter( book => !book.isBookWithTeam && book.isKnown );
	const weightedTransfers = {} as Record<PlayerId, number>;

	for ( const { book } of validBooks ) {
		const state = bookStates[ book ];

		for ( const cardId of state.cards ) {
			const owner = state.knownOwners[ cardId ] || state.inferredOwners[ cardId ];
			if ( owner && currentPlayer.teamMates.includes( owner ) ) {
				weightedTransfers[ owner ] = ( weightedTransfers[ owner ] ?? 0 ) + MAX_WEIGHT;
			}
		}
	}

	logger.debug( "<< suggestTransfers()" );
	return Object.entries( weightedTransfers )
		.map( ( [ transferTo, weight ] ) => ( { transferTo, weight } ) )
		.toSorted( ( a, b ) => b.weight - a.weight );
}