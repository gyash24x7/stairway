import type { Book, FishConfig, FishPlayerView } from "@/games/fish/shared/schema.ts";
import {
	getBookForCard,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	getTeammates
} from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";

/** A book with a calculated priority weight for bot decision-making. */
type WeightedBook = {
	book: Book;
	weight: number;
	isBookWithTeam: boolean;
	isClaimable: boolean;
	isKnown: boolean;
};

/** An ask proposal with a calculated priority weight for bot decision-making. */
type WeightedAsk = {
	cardId: CardId;
	playerId: PlayerId;
	weight: number;
};

/** A claim proposal with a calculated confidence weight for bot decision-making. */
type WeightedClaim = {
	book: Book;
	claim: Partial<Record<CardId, PlayerId>>;
	weight: number;
};

/** A transfer target with a calculated weight for bot decision-making. */
type WeightedTransfer = {
	weight: number;
	transferTo: PlayerId;
};

/** A detected signal pattern suggesting a teammate likely holds a specific card. */
type TeammateSignal = {
	cardId: CardId;
	likelyHolder: PlayerId;
	book: Book;
	confidence: number;
};

const MAX_WEIGHT = 720;
const SIGNAL_WINDOW = 30;

/**
 * Detects teammate signaling patterns from ask history.
 * Pattern: Teammate T fails to get card X from book B, then teammate T2's next ask
 * is for a different card from the same book B — this signals T2 likely holds card X.
 *
 * @param state GameState for the bot
 * @param config Game Config
 * @returns list of detected teammate signals
 * @public
 */
export function detectTeammateSignals( state: FishPlayerView, config: FishConfig ) {
	const teammates = getTeammates( state.teams, state.playerId );
	if ( teammates.length === 0 ) {
		return [];
	}

	const recentAsks = state.askHistory.slice( 0, SIGNAL_WINDOW );
	const signals = new Map<CardId, TeammateSignal>();

	// askHistory is newest-first; iterate from oldest to newest to find A1 → A2 pairs
	for ( let i = recentAsks.length - 1; i >= 0; i-- ) {
		const a1 = recentAsks[ i ];

		// A1 must be a failed ask by a teammate (not the bot itself)
		if ( a1.success || !teammates.includes( a1.playerId ) ) {
			continue;
		}

		const book = getBookForCard( a1.cardId, config.type );

		// Find each other teammate's first ask after A1 (scanning newer entries: i-1 down to 0)
		const seen = new Set<PlayerId>();
		for ( let j = i - 1; j >= 0; j-- ) {
			const a2 = recentAsks[ j ];

			// Must be a different teammate (not A1's asker, not the bot)
			if ( a2.playerId === a1.playerId || a2.playerId === state.playerId ) {
				continue;
			}
			if ( !teammates.includes( a2.playerId ) ) {
				continue;
			}

			// Only consider T2's first ask after A1
			if ( seen.has( a2.playerId ) ) {
				continue;
			}
			seen.add( a2.playerId );

			// Signal: T2 asked from the same book but a different card
			const a2Book = getBookForCard( a2.cardId, config.type );
			if ( a2Book !== book || a2.cardId === a1.cardId ) {
				continue;
			}

			// Validate: card X must still be trackable and T2 must be a possible owner
			const possibleOwners = state.cardLocations[ a1.cardId ];
			if ( !possibleOwners || possibleOwners.length <= 1 ) {
				continue;
			}
			if ( !possibleOwners.includes( a2.playerId ) ) {
				continue;
			}
			if ( state.hand.includes( a1.cardId ) ) {
				continue;
			}

			// Confidence based on number of intervening asks
			const gap = i - j - 1;
			const confidence = gap <= 2 ? 0.7 : gap <= 5 ? 0.4 : 0.2;

			// Keep only the most recent (highest index j = closest to 0) signal per card
			if ( !signals.has( a1.cardId ) ) {
				signals.set( a1.cardId, {
					cardId: a1.cardId,
					likelyHolder: a2.playerId,
					book,
					confidence
				} );
			}
		}
	}

	return Array.from( signals.values() );
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
 * @param state GameState for the bot
 * @param config Game Config
 * @param signals Signals by teammates
 * @returns sorted list of weighted book suggestions.
 * @public
 */
export function suggestBooks(
	state: FishPlayerView,
	config: FishConfig,
	signals: TeammateSignal[] = []
) {

	const booksInGame = new Set( Object.keys( state.cardLocations )
		.map( k => getBookForCard( k as CardId, config.type ) ) );
	const validBooks = Array.from( booksInGame );
	const teamMates = getTeammates( state.teams, state.playerId );
	const signalMap = new Map( signals.map( s => [ s.cardId, s ] ) );
	const weightedBooks: WeightedBook[] = [];

	for ( const book of validBooks ) {

		const weightedBook = {
			book,
			weight: 0,
			isBookWithTeam: true,
			isClaimable: true,
			isKnown: true
		};
		const cardsInBook = getCardsOfBook( book, config.type );

		for ( const cardId of cardsInBook ) {
			const possibleOwners = state.cardLocations[ cardId ]!;

			if ( state.hand.includes( cardId ) ) {
				weightedBook.weight += MAX_WEIGHT;
				continue;
			}

			const signal = signalMap.get( cardId as CardId );
			const isCardLocationKnown = possibleOwners.length === 1;
			const isCardWithTeam = possibleOwners.every( pid => teamMates.includes( pid ) );

			if ( signal && possibleOwners.includes( signal.likelyHolder ) ) {
				// Signal suggests a teammate holds this card — boost weight
				weightedBook.weight += MAX_WEIGHT * signal.confidence;
				weightedBook.isBookWithTeam =
					weightedBook.isBookWithTeam && teamMates.includes( signal.likelyHolder );
			} else {
				weightedBook.weight += MAX_WEIGHT / possibleOwners.length;
				weightedBook.isBookWithTeam = weightedBook.isBookWithTeam && isCardWithTeam;
			}

			weightedBook.isKnown = weightedBook.isKnown && isCardLocationKnown;
			weightedBook.isClaimable =
				weightedBook.isClaimable && weightedBook.isKnown && isCardLocationKnown;
		}

		weightedBooks.push( { ...weightedBook, weight: weightedBook.weight / cardsInBook.length } );
	}

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
 * @param signals Signals by teammates
 * @returns ordered list of weighted ask proposals.
 * @public
 */
export function suggestAsks(
	books: WeightedBook[],
	state: FishPlayerView,
	config: FishConfig,
	signals: TeammateSignal[] = []
) {

	const teamMates = getTeammates( state.teams, state.playerId );
	const booksInHand = getBooksInHand( state.hand, config.type );
	// Asking requires holding at least one card from the book
	const askableBooks = books.filter( ( { book } ) => booksInHand.includes( book ) );
	const signalMap = new Map( signals.map( s => [ s.cardId, s ] ) );
	const signaledBooks = new Set( signals.map( s => s.book ) );

	// Detect books where a teammate recently asked for a card the bot holds (opportunity to signal back)
	const booksToSignal = detectBooksToSignal( state, config );

	// Track which books each player is known to hold cards from (inferred from their asks)
	const knownBookHolders = getKnownBookHolders( state, config );

	// Determine the book the bot was last asking from — stick to it if opponents may still hold cards
	const activeBook = getActiveBook( state, config, teamMates );

	const weightedAsks: WeightedAsk[] = [];

	for ( const { book } of askableBooks ) {
		const missingCards = getMissingCards( state.hand, book, config.type );
		const asksForBook: WeightedAsk[] = [];

		for ( const cardId of missingCards ) {
			const possibleOwners = state.cardLocations[ cardId ]!;
			for ( const pid of possibleOwners ) {
				if ( pid !==
					state.playerId &&
					!teamMates.includes( pid ) &&
					state.cardCounts[ pid ] >
					0 ) {
					let weight = MAX_WEIGHT / possibleOwners.length;

					const signal = signalMap.get( cardId );
					if ( signal ) {
						// A teammate likely holds this card — deprioritize asking opponents for it
						weight *= ( 1 - signal.confidence );
					} else if ( signaledBooks.has( book ) ) {
						// A teammate signaled in this book — boost asks for other cards to help complete it
						weight *= ( 1 + 0.5 );
					}

					// Signal back: boost asks from books where a teammate asked for a card the bot holds
					if ( booksToSignal.has( book ) ) {
						weight *= 2;
					}

					// Boost if this opponent has demonstrated holding cards from this book
					if ( knownBookHolders.get( pid )?.has( book ) ) {
						weight *= 1.5;
					}

					// Stick to the active book — heavily boost to keep asking from it
					if ( activeBook && book === activeBook ) {
						weight *= 3;
					}

					asksForBook.push( { playerId: pid, cardId, weight } );
				}
			}
		}

		const shuffledAsks = asksForBook.toSorted(
			( a, b ) => b.weight - a.weight || Math.random() - 0.5
		);

		weightedAsks.push( ...shuffledAsks );
	}

	return weightedAsks;
}

/**
 * Detects books where a teammate recently failed to get a card that the bot holds.
 * The bot should signal back by asking from the same book on its turn.
 * Only considers the most recent few asks to keep signals timely.
 */
function detectBooksToSignal( state: FishPlayerView, config: FishConfig ) {
	const teammates = getTeammates( state.teams, state.playerId );
	const booksToSignal = new Set<Book>();

	// Look at recent asks (scan up to 6 most recent for freshness)
	const recentAsks = state.askHistory.slice( 0, 6 );

	for ( const ask of recentAsks ) {
		// Teammate failed to get a card that the bot currently holds
		if ( !ask.success && teammates.includes( ask.playerId ) && state.hand.includes( ask.cardId ) ) {
			booksToSignal.add( getBookForCard( ask.cardId, config.type ) );
		}
	}

	return booksToSignal;
}

/**
 * Determines the book the bot should keep asking from. Finds the bot's most recent ask
 * and returns that book if any opponent might still hold missing cards from it.
 * Returns undefined if the bot should move on to a different book.
 */
function getActiveBook(
	state: FishPlayerView,
	config: FishConfig,
	teamMates: PlayerId[]
) {
	// Find the bot's most recent ask
	const lastAsk = state.askHistory.find( a => a.playerId === state.playerId );
	if ( !lastAsk ) {
		return undefined;
	}

	const book = getBookForCard( lastAsk.cardId, config.type );
	const missingCards = getMissingCards( state.hand, book, config.type );

	// Check if any opponent could still hold a missing card from this book
	const opponentMayHoldCard = missingCards.some( cardId => {
		const possibleOwners = state.cardLocations[ cardId ];
		if ( !possibleOwners ) {
			return false;
		}
		return possibleOwners.some(
			pid => pid !== state.playerId
				&& !teamMates.includes( pid )
				&& state.cardCounts[ pid ] > 0
		);
	} );

	return opponentMayHoldCard ? book : undefined;
}

/**
 * Builds a map of player → books they are known to hold cards from,
 * inferred from ask history. A player who asked for a card from book B
 * must hold at least one other card from book B (game rule).
 */
function getKnownBookHolders( state: FishPlayerView, config: FishConfig ) {
	const holders = new Map<PlayerId, Set<Book>>();

	for ( const ask of state.askHistory ) {
		// The asker must hold at least one card from this book
		if ( state.cardCounts[ ask.playerId ] > 0 ) {
			const book = getBookForCard( ask.cardId, config.type );
			if ( !holders.has( ask.playerId ) ) {
				holders.set( ask.playerId, new Set() );
			}
			holders.get( ask.playerId )!.add( book );
		}
	}

	return holders;
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
 * @param signals Signals by teammates
 * @returns list of viable claims ordered by confidence weight.
 * @public
 */
export function suggestClaims(
	books: WeightedBook[],
	state: FishPlayerView,
	config: FishConfig,
	signals: TeammateSignal[] = []
) {

	const teamMates = getTeammates( state.teams, state.playerId );
	const signalMap = new Map( signals.map( s => [ s.cardId, s ] ) );
	const knownBookHolders = getKnownBookHolders( state, config );
	const validBooks = books.filter( book => book.isClaimable || book.isBookWithTeam );
	const claims: WeightedClaim[] = [];

	for ( const { book } of validBooks ) {
		let weight = 0;
		let allAssigned = true;
		const claim = {} as Record<CardId, PlayerId>;
		const cardsInBook = getCardsOfBook( book, config.type );

		for ( const cardId of cardsInBook ) {
			const possibleOwners = state.cardLocations[ cardId ]!;

			if ( possibleOwners.length === 1 ) {
				// Known owner
				weight += MAX_WEIGHT;
				claim[ cardId ] = possibleOwners[ 0 ];
			} else {
				// Check if a signal can fill in the gap
				const signal = signalMap.get( cardId as CardId );
				if ( signal &&
					possibleOwners.includes( signal.likelyHolder ) &&
					teamMates.includes( signal.likelyHolder ) ) {
					weight += MAX_WEIGHT * signal.confidence;
					claim[ cardId ] = signal.likelyHolder;
				} else {
					// Check if a teammate among possible owners is known to hold cards from this book
					const knownTeammate = possibleOwners.find(
						pid => teamMates.includes( pid ) && knownBookHolders.get( pid )?.has( book )
					);
					if ( knownTeammate ) {
						weight += MAX_WEIGHT * 0.3;
						claim[ cardId ] = knownTeammate;
					} else {
						allAssigned = false;
					}
				}
			}
		}

		// Only claim if every card in the book has an assigned holder
		if ( allAssigned && Object.keys( claim ).length === cardsInBook.length ) {
			// All holders must be teammates or the bot itself
			const allWithTeam = Object.values( claim ).every(
				pid => pid === state.playerId || teamMates.includes( pid )
			);
			if ( allWithTeam ) {
				claims.push( { book, claim, weight: weight / cardsInBook.length } );
			}
		}
	}

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
export function suggestTransfers( state: FishPlayerView, config: FishConfig ) {

	const teamMates = getTeammates( state.teams, state.playerId );
	const validBooks = new Set( Object.keys( state.cardLocations )
		.map( k => getBookForCard( k as CardId, config.type ) ) );

	const weightedTransfers = {} as Record<PlayerId, number>;

	for ( const book of validBooks ) {
		const cardsInBook = getCardsOfBook( book, config.type );
		for ( const cardId of cardsInBook ) {
			const possibleOwners = state.cardLocations[ cardId ];
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
		.map( ( [ transferTo, weight ] ) => ( { transferTo: transferTo as PlayerId, weight } ) )
		.toSorted( ( a, b ) => b.weight - a.weight || Math.random() - 0.5 );

	return transfers;
}
