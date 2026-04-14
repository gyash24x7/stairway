import type {
	FishConfig,
	FishPlayerView,
	WeightedAsk,
	WeightedBook,
	WeightedClaim,
	WeightedTransfer
} from "@/fish/core/types";
import { getBookForCard, getBooksInHand, getCardsOfBook, getMissingCards, getTeammates } from "@/fish/core/utils";
import type { GameState, PlayerId } from "@/shared/engine/types";
import type { CardId } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";

const MAX_WEIGHT = 720;

const logger = createLogger( "Fish:Bot" );

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
 * @param state GameState for the bot
 * @param config Game Config
 * @returns sorted list of weighted book suggestions.
 * @public
 */
export function suggestBooks( state: GameState<FishPlayerView>, config: FishConfig ) {
	logger.debug( ">> suggestBooks()" );

	const booksInGame = new Set( Object.keys( state.data.cardLocations )
		.map( k => getBookForCard( k as CardId, config.type ) ) );
	const validBooks = Array.from( booksInGame );
	const teamMates = getTeammates( state.data.teams, state.data.playerId );
	const weightedBooks: WeightedBook[] = [];

	for ( const book of validBooks ) {

		const weightedBook = { book, weight: 0, isBookWithTeam: true, isClaimable: true, isKnown: true };
		const cardsInBook = getCardsOfBook( book, config.type );

		for ( const cardId of cardsInBook ) {
			const possibleOwners = state.data.cardLocations[ cardId ]!;

			if ( state.data.hand.includes( cardId ) ) {
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
		.toSorted( ( a, b ) => b.weight - a.weight || Math.random() - 0.5 );
}

/**
 * Suggest ask proposals for missing cards in the given books.
 * Logic for weighting asks:
 * - If the card has a known owner who is not on the player's team, assign maximum weight.
 * - If the card has possible owners not on the player's team, distribute weight equally among them.
 *
 * @param books weighted book suggestions to consider.
 * @param state GameState for the bot
 * @param config Game Config
 * @returns ordered list of weighted ask proposals.
 * @public
 */
export function suggestAsks( books: WeightedBook[], state: GameState<FishPlayerView>, config: FishConfig ) {
	logger.debug( ">> suggestAsks()" );

	const teamMates = getTeammates( state.data.teams, state.data.playerId );
	const booksInHand = getBooksInHand( state.data.hand, config.type );
	// Asking requires holding at least one card from the book
	const askableBooks = books.filter( ( { book } ) => booksInHand.includes( book ) );
	const weightedAsks: WeightedAsk[] = [];

	for ( const { book } of askableBooks ) {
		const missingCards = getMissingCards( state.data.hand, book, config.type );
		const asksForBook: WeightedAsk[] = [];

		for ( const cardId of missingCards ) {
			const possibleOwners = state.data.cardLocations[ cardId ]!;
			for ( const pid of possibleOwners ) {
				if ( pid !== state.data.playerId && !teamMates.includes( pid ) && state.data.cardCounts[ pid ] > 0 ) {
					asksForBook.push( { playerId: pid, cardId, weight: MAX_WEIGHT / possibleOwners.length } );
				}
			}
		}

		weightedAsks.push( ...asksForBook.toSorted( ( a, b ) => b.weight - a.weight || Math.random() - 0.5 ) );
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
 * @param state GameState for the bot
 * @param config Game Config
 * @returns list of viable claims ordered by confidence weight.
 * @public
 */
export function suggestClaims( books: WeightedBook[], state: GameState<FishPlayerView>, config: FishConfig ) {
	logger.debug( ">> suggestClaims()" );

	const validBooks = books.filter( book => book.isClaimable && book.isBookWithTeam );
	const claims: WeightedClaim[] = [];

	for ( const { book } of validBooks ) {
		let weight = 0;
		const claim = {} as Record<CardId, PlayerId>;
		const cardsInBook = getCardsOfBook( book, config.type );

		for ( const cardId of cardsInBook ) {
			const possibleOwners = state.data.cardLocations[ cardId ]!;

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
	return claims.sort( ( a, b ) => b.weight - a.weight || Math.random() - 0.5 );
}

/**
 * Suggest transfer targets for cards in known books.
 * Logic for weighting transfers:
 * - Each card in the book that is known to be with a team member adds maximum weight to that member.
 *
 * @param state GameState for the bot
 * @param config Game Config
 * @returns sorted list of transfer recommendations.
 * @public
 */
export function suggestTransfers( state: GameState<FishPlayerView>, config: FishConfig ) {
	logger.debug( ">> suggestTransfers()" );

	const teamMates = getTeammates( state.data.teams, state.data.playerId );
	const validBooks = new Set( Object.keys( state.data.cardLocations )
		.map( k => getBookForCard( k as CardId, config.type ) ) );

	const weightedTransfers = {} as Record<PlayerId, number>;

	for ( const book of validBooks ) {
		const cardsInBook = getCardsOfBook( book, config.type );
		for ( const cardId of cardsInBook ) {
			const possibleOwners = state.data.cardLocations[ cardId ];
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
		.toSorted( ( a, b ) => b.weight - a.weight || Math.random() - 0.5 );

	logger.debug( "<< suggestTransfers()" );
	return transfers;
}
