import type { CardId } from "@/core/cards/types";
import { isCardInHand } from "@/core/cards/utils";
import type {
	PlayerGameInfo,
	PlayerId,
	WeightedAsk,
	WeightedBook,
	WeightedClaim,
	WeightedTransfer
} from "@/core/fish/schema";
import { getBooksInHand, getMissingCards } from "@/core/fish/utils";
import { createLogger } from "@/utils/logger";

const logger = createLogger( "Fish:Bot" );
const MAX_WEIGHT = 720;

/**
 * Suggests books that the player can ask from or claim based on their hand and the current game state.
 * The books are weighted based on how likely they are to be completed.
 * The weight is calculated for each card and averaged for a book. It is calculated as follows:
 * - If the player has the card in hand, the weight is MAX_WEIGHT.
 * - If the card's owner is known, the weight is MAX_WEIGHT.
 * - If the card's owner is inferred, the weight is MAX_WEIGHT / 2.
 * - If the card's owner is neither known nor inferred, the weight is MAX_WEIGHT / number of possible owners.
 *
 * @param {PlayerGameInfo} playerGameInfo - The game information for the player
 * @returns {WeightedBook[]} - An array of weighted books that the player can ask from or claim.
 */
function suggestBooks( { playerId, hand, players, bookStates, config }: PlayerGameInfo ): WeightedBook[] {
	logger.debug( ">> suggestBooks()" );

	const validBooks = config.books.filter( book => !!bookStates[ book ] );
	const currentPlayer = players[ playerId ];
	const weightedBooks: WeightedBook[] = [];

	for ( const book of validBooks ) {

		const weightedBook = { book, weight: 0, isBookWithTeam: true, isClaimable: true, isKnown: true };
		const state = bookStates[ book ];
		if ( !state ) {
			continue;
		}

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

			if ( state.possibleOwners[ cardId ] && state.possibleOwners[ cardId ].length > 0 ) {
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

/**
 * Suggests asks for cards based on the player's hand and the current game state.
 * The asks are weighted based on the likelihood of getting the card from the specified player.
 * The weight is calculated as follows:
 * - If the card's owner is known, the weight is MAX_WEIGHT.
 * - If the card's owner is inferred, the weight is MAX_WEIGHT / 2.
 * - If the card's owner is neither known nor inferred, the weight is MAX_WEIGHT / number of possible owners.
 *
 * @param {WeightedBook[]} books - The list of books in the game.
 * @param {PlayerGameInfo} data - The game information for the player.
 * @returns {WeightedAsk[]} - An array of weighted asks that the player can make.
 */
function suggestAsks( books: WeightedBook[], data: PlayerGameInfo ): WeightedAsk[] {
	logger.debug( ">> suggestAsks()" );

	const { playerId, hand, players, bookStates, config } = data;
	const currentPlayer = players[ playerId ];
	const weightedAsks: WeightedAsk[] = [];

	for ( const { book } of books ) {
		const missingCards = getMissingCards( hand, book, config.type );
		const asksForBook: WeightedAsk[] = [];
		const state = bookStates[ book ];
		if ( !state ) {
			continue;
		}

		for ( const cardId of missingCards ) {
			const knownOwner = state.knownOwners[ cardId ];
			const possibleOwners = state.possibleOwners[ cardId ] ?? [];

			if ( knownOwner && knownOwner !== playerId && !currentPlayer.teamMates.includes( knownOwner ) ) {
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

/**
 * Suggests claims for books based on the current game state.
 * The claims are weighted based on the completeness of the book and the known/inferred owners of the cards.
 * The weight of a claim is summed up from the weights of the cards in the book:
 * - If the card's owner is known, the weight is MAX_WEIGHT.
 * - If the card's owner is inferred, the weight is MAX_WEIGHT / 2.
 * - If the card's owner is neither known nor inferred, the book is not claimable.
 *
 * @param {WeightedBook[]} books - The list of weighted books in the game.
 * @param {PlayerGameInfo} data - The game information for the player.
 * @return {WeightedClaim[]} - An array of weighted claims that the player can make.
 */
function suggestClaims( books: WeightedBook[], { bookStates }: PlayerGameInfo ): WeightedClaim[] {
	logger.debug( ">> suggestClaims()" );

	const validBooks = books.filter( book => book.isClaimable && book.isBookWithTeam );
	const claims: WeightedClaim[] = [];

	for ( const { book } of validBooks ) {
		const state = bookStates[ book ];
		let weight = 0;
		const claim = {} as Record<CardId, PlayerId>;
		if ( !state ) {
			continue;
		}

		for ( const cardId of state.cards ) {
			if ( state.knownOwners[ cardId ] ) {
				weight += MAX_WEIGHT;
				claim[ cardId ] = state.knownOwners[ cardId ];
			} else if ( state.inferredOwners[ cardId ] ) {
				weight += MAX_WEIGHT / 2;
				claim[ cardId ] = state.inferredOwners[ cardId ];
			}
		}

		if ( Object.keys( claim ).length === state.cards.length ) {
			claims.push( { book, claim, weight } );
		}
	}

	logger.debug( "<< suggestClaims()" );
	return claims.sort( ( a, b ) => b.weight - a.weight );
}

/**
 * Suggests transfers of cards to team members based on the current game state.
 * The transfers are weighted based on the number of cards that can be transferred to teammates.
 * Preference is given to books that are not completely with the team and have maximum information about card ownership.
 * If there are no books which can be snatched, there's no need to transfer turn
 *
 * @param {WeightedBook[]} books - The list of weighted books in the game.
 * @param {PlayerGameInfo} data - The game information for the player.
 * @returns {WeightedTransfer[]} - An array of suggested transfers with weights.
 */
function suggestTransfers( books: WeightedBook[], data: PlayerGameInfo ): WeightedTransfer[] {
	logger.debug( ">> suggestTransfers()" );

	const { playerId, players, bookStates } = data;
	const currentPlayer = players[ playerId ];
	const validBooks = books.filter( book => !book.isBookWithTeam && book.isKnown );
	const weightedTransfers = {} as Record<PlayerId, number>;

	for ( const { book } of validBooks ) {
		const state = bookStates[ book ];
		if ( !state ) {
			continue;
		}

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

export const botEngine = { suggestBooks, suggestAsks, suggestClaims, suggestTransfers };