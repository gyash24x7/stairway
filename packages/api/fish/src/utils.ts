import type { CardId } from "@s2h/schema/cards";
import type { BookType, FishEvent, FishState } from "@s2h/schema/fish";
import { BookClaimed, CardAsked } from "@s2h/schema/fish";
import { PlayerId } from "@s2h/schema/swish";
import { remove } from "@s2h/utils/array";
import { CARD_RANKS, getCardRank } from "@s2h/utils/cards";
import { getCardsOfBook } from "@s2h/utils/fish";
import * as Match from "effect/Match";

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
		{
			success: e.success,
			playerId: e.playerId,
			from: e.from,
			cardId: e.cardId,
			timestamp: e.timestamp
		},
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

	return {
		...state,
		hands,
		cardCounts,
		playerData,
		cardLocations,
		askHistory,
		lastMoveType: "ask"
	};
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
				teams[ t.id ] =
					{ id: t.id, name: t.name, members: [ ...t.members ], score: 0, booksWon: [] };
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
