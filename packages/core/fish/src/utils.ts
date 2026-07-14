import { PlayerId, type PlayerInfo } from "@s2h/swish/schema";
import { remove } from "@s2h/utils/array";
import {
	CARD_RANKS,
	type CardId,
	getCardDisplayString,
	getCardRank
} from "@s2h/utils/cards";
import * as Match from "effect/Match";
import type {
	Ask,
	Book,
	BookType,
	Claim,
	FishEvent,
	FishState,
	Team,
	Transfer
} from "./schema";
import {
	BookClaimed,
	CardAsked
} from "./schema";

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

/** Registry slug for this game (also the DO name prefix). */
export const GAME_NAME = "fish";

// --- Reducer ---------------------------------------------------------------
// The ONLY place `state` changes. Pure, synchronous — no Effect, no Random. The
// deterministic card-tracking bookkeeping the old `execute` did inline lives
// here; nondeterministic facts are read straight from the event payload.

const DEFAULT_METRICS = {
	totalAsks: 0,
	cardsGiven: 0,
	cardsTaken: 0,
	totalClaims: 0,
	successfulClaims: 0
};

// The book variant is derivable from any team's booksWon or the deck; simpler to
// infer from the presence of 7s in the tracked deck (Canadian removes 7s). When
// the deck is fully claimed this is ambiguous, but claims resolve before that
// point; fall back to NORMAL only when no cards remain.
const bookTypeOf = ( state: FishState ): BookType => {
	const cards = Object.keys( state.cardLocations );
	const hasSeven = cards.some( c => getCardRank( c as CardId ) === CARD_RANKS.SEVEN );
	return hasSeven ? "NORMAL" : ( cards.length > 0 ? "CANADIAN" : "NORMAL" );
};

const applyAsk = ( state: FishState, e: CardAsked ): FishState => {
	const hands = { ...state.hands } as Record<PlayerId, CardId[]>;
	const cardCounts = { ...state.cardCounts };
	const playerData = { ...state.playerData };
	const cardLocations = { ...state.cardLocations } as Record<CardId, PlayerId[]>;

	const asker = playerData[ e.playerId ];
	const askerData = { ...asker, metrics: { ...asker.metrics } };
	playerData[ e.playerId ] = askerData;

	if ( e.success ) {
		hands[ e.from ] = ( hands[ e.from ] ?? [] ).filter( c => c !== e.cardId );
		cardCounts[ e.from ] = ( cardCounts[ e.from ] ?? 0 ) - 1;
		const fromData = { ...playerData[ e.from ], metrics: { ...playerData[ e.from ].metrics } };
		fromData.metrics.cardsGiven++;
		playerData[ e.from ] = fromData;

		hands[ e.playerId ] = [ ...( hands[ e.playerId ] ?? [] ), e.cardId ];
		cardCounts[ e.playerId ] = ( cardCounts[ e.playerId ] ?? 0 ) + 1;
		askerData.metrics.cardsTaken++;
	}

	askerData.metrics.totalAsks++;

	const askHistory = [
		{ success: e.success, playerId: e.playerId, from: e.from, cardId: e.cardId, timestamp: e.timestamp },
		...state.askHistory
	];

	const possibleOwners = cardLocations[ e.cardId ] ?? [];
	cardLocations[ e.cardId ] = e.success
		? [ e.playerId ]
		: remove( p => p === e.from || p === e.playerId, possibleOwners );

	if ( e.success && ( cardCounts[ e.from ] ?? 0 ) <= 0 ) {
		for ( const cid of Object.keys( cardLocations ) as CardId[] ) {
			const owners = cardLocations[ cid ];
			if ( owners && owners.includes( e.from ) ) {
				cardLocations[ cid ] = owners.filter( pid => pid !== e.from );
			}
		}
	}

	return { ...state, hands, cardCounts, playerData, cardLocations, askHistory, lastMoveType: "ask" };
};

const applyClaim = ( state: FishState, e: BookClaimed ): FishState => {
	const allBookCards = getCardsOfBook( e.book, bookTypeOf( state ) );
	const hands: Record<PlayerId, CardId[]> = {};
	for ( const [ pid, hand ] of Object.entries( state.hands ) ) {
		hands[ pid as PlayerId ] = hand.filter( c => !allBookCards.includes( c ) );
	}

	const cardCounts = { ...state.cardCounts };
	const cardLocations = { ...state.cardLocations } as Record<CardId, PlayerId[]>;
	for ( const card of allBookCards ) {
		const owner = e.correctClaim[ card ];
		if ( owner ) {
			cardCounts[ owner ] = ( cardCounts[ owner ] ?? 0 ) - 1;
		}
		delete cardLocations[ card ];
	}

	const emptyPlayers = new Set(
		Object.keys( cardCounts ).filter( pid => ( cardCounts[ pid as PlayerId ] ?? 0 ) <= 0 )
	);
	if ( emptyPlayers.size > 0 ) {
		for ( const cardId of Object.keys( cardLocations ) as CardId[] ) {
			const owners = cardLocations[ cardId ];
			if ( owners ) {
				const filtered = owners.filter( pid => !emptyPlayers.has( pid ) );
				if ( filtered.length > 0 ) {
					cardLocations[ cardId ] = filtered;
				}
			}
		}
	}

	const winner = state.teams[ e.winningTeamId ];
	const teams = {
		...state.teams,
		[ e.winningTeamId ]: {
			...winner,
			booksWon: [ ...winner.booksWon, e.book ],
			score: winner.score + 1
		}
	};

	const claimer = state.playerData[ e.playerId ];
	const claimerData = { ...claimer, metrics: { ...claimer.metrics } };
	claimerData.metrics.totalClaims++;
	if ( e.success ) {
		claimerData.metrics.successfulClaims++;
	}
	const playerData = { ...state.playerData, [ e.playerId ]: claimerData };

	const claimHistory = [
		{
			success: e.success,
			playerId: e.playerId,
			book: e.book,
			correctClaim: e.correctClaim,
			actualClaim: e.actualClaim,
			timestamp: e.timestamp
		},
		...state.claimHistory
	];

	return {
		...state,
		hands,
		cardCounts,
		cardLocations,
		teams,
		playerData,
		claimHistory,
		lastMoveType: "claim"
	};
};

/** Pure reducer — the ONLY place `state` changes. */
export const apply = ( state: FishState, event: FishEvent ): FishState =>
	Match.value( event ).pipe(
		Match.tag( "fish/PlayerSeated", ( e ) => ( {
			...state,
			playerData: {
				...state.playerData,
				[ e.playerId ]: { teamId: "", metrics: { ...DEFAULT_METRICS } }
			}
		} ) ),
		Match.tag( "fish/TeamsCreated", ( e ) => {
			const teams = { ...state.teams };
			const playerData = { ...state.playerData };
			for ( const t of e.teams ) {
				teams[ t.id ] = { id: t.id, name: t.name, members: [ ...t.members ], score: 0, booksWon: [] };
				for ( const pid of t.members ) {
					playerData[ pid ] = { ...playerData[ pid ], teamId: t.id };
				}
			}
			return { ...state, teams, playerData };
		} ),
		Match.tag( "fish/HandsDealt", ( e ) => ( {
			...state,
			hands: { ...e.hands },
			cardCounts: { ...e.cardCounts },
			cardLocations: { ...e.cardLocations }
		} ) ),
		Match.tag( "fish/CardAsked", ( e ) => applyAsk( state, e ) ),
		Match.tag( "fish/BookClaimed", ( e ) => applyClaim( state, e ) ),
		Match.tag( "fish/TurnTransferred", ( e ) => ( {
			...state,
			lastMoveType: "transfer" as const,
			transferHistory: [
				{ playerId: e.playerId, transferTo: e.transferTo, timestamp: e.timestamp },
				...state.transferHistory
			]
		} ) ),
		Match.tag( "fish/WinningTeamDecided", ( e ) => ( { ...state, winningTeam: e.teamId } ) ),
		Match.exhaustive
	);
