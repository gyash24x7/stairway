import type { BookType, FishEvent, FishState } from "@/games/fish/shared/schema";
import { BookClaimed, CardAsked } from "@/games/fish/shared/schema";
import { getCardsOfBook } from "@/games/fish/shared/utils";
import type { CardId } from "@/shared/cards/schema";
import { CARD_RANKS, getCardRank } from "@/shared/cards/utils.ts";
import { PlayerId } from "@/shared/swish/schema";
import { remove } from "@/shared/utils/array";
import * as Match from "effect/Match";
import { castDraft, type Draft, produce } from "immer";

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

const applyAsk = ( draft: Draft<FishState>, e: CardAsked ): void => {
	const asker = draft.playerData[ e.playerId ]!;

	if ( e.success ) {
		draft.hands[ e.from ] = ( draft.hands[ e.from ] ?? [] ).filter( c => c !== e.cardId );
		draft.cardCounts[ e.from ] = ( draft.cardCounts[ e.from ] ?? 0 ) - 1;
		draft.playerData[ e.from ]!.metrics.cardsGiven++;

		( draft.hands[ e.playerId ] ??= [] ).push( e.cardId );
		draft.cardCounts[ e.playerId ] = ( draft.cardCounts[ e.playerId ] ?? 0 ) + 1;
		asker.metrics.cardsTaken++;
	}

	asker.metrics.totalAsks++;

	draft.askHistory.unshift( {
		success: e.success,
		playerId: e.playerId,
		from: e.from,
		cardId: e.cardId,
		timestamp: e.timestamp
	} );

	const possibleOwners = draft.cardLocations[ e.cardId ] ?? [];
	draft.cardLocations[ e.cardId ] = e.success
		? [ e.playerId ]
		: remove( p => p === e.from || p === e.playerId, possibleOwners );

	if ( e.success && ( draft.cardCounts[ e.from ] ?? 0 ) <= 0 ) {
		for ( const cid of Object.keys( draft.cardLocations ) as CardId[] ) {
			const owners = draft.cardLocations[ cid ];
			if ( owners && owners.includes( e.from ) ) {
				draft.cardLocations[ cid ] = owners.filter( pid => pid !== e.from );
			}
		}
	}

	draft.lastMoveType = "ask";
};

const applyClaim = ( draft: Draft<FishState>, e: BookClaimed ): void => {
	const allBookCards = getCardsOfBook( e.book, bookTypeOf( draft ) );
	for ( const [ pid, hand ] of Object.entries( draft.hands ) ) {
		draft.hands[ pid as PlayerId ] = hand.filter( c => !allBookCards.includes( c ) );
	}

	for ( const card of allBookCards ) {
		const owner = e.correctClaim[ card ];
		if ( owner ) {
			draft.cardCounts[ owner ] = ( draft.cardCounts[ owner ] ?? 0 ) - 1;
		}

		delete draft.cardLocations[ card ];
	}

	const emptyPlayers = new Set(
		Object.keys( draft.cardCounts )
			.filter( pid => ( draft.cardCounts[ pid as PlayerId ] ?? 0 ) <= 0 )
	);
	if ( emptyPlayers.size > 0 ) {
		for ( const cardId of Object.keys( draft.cardLocations ) as CardId[] ) {
			const owners = draft.cardLocations[ cardId ];
			if ( owners ) {
				const filtered = owners.filter( pid => !emptyPlayers.has( pid ) );
				if ( filtered.length > 0 ) {
					draft.cardLocations[ cardId ] = filtered;
				}
			}
		}
	}

	const winner = draft.teams[ e.winningTeamId ]!;
	winner.booksWon.push( e.book );
	winner.score += 1;

	const claimer = draft.playerData[ e.playerId ]!;
	claimer.metrics.totalClaims++;
	if ( e.success ) {
		claimer.metrics.successfulClaims++;
	}

	draft.claimHistory.unshift( {
		success: e.success,
		playerId: e.playerId,
		book: e.book,
		correctClaim: castDraft( e.correctClaim ),
		actualClaim: castDraft( e.actualClaim ),
		timestamp: e.timestamp
	} );

	draft.lastMoveType = "claim";
};

/** Pure reducer — the ONLY place `state` changes. Mutations are on an immer draft. */
export const apply = ( state: FishState, event: FishEvent ): FishState =>
	produce( state, ( draft ) => {
		Match.value( event ).pipe(
			Match.tag( "fish/PlayerSeated", ( e ) => {
				draft.playerData[ e.playerId ] = { teamId: "", metrics: { ...DEFAULT_METRICS } };
			} ),
			Match.tag( "fish/TeamsCreated", ( e ) => {
				for ( const t of e.teams ) {
					draft.teams[ t.id ] = castDraft( {
						id: t.id,
						name: t.name,
						members: [ ...t.members ],
						score: 0,
						booksWon: []
					} );
					for ( const pid of t.members ) {
						const pd = draft.playerData[ pid ];
						if ( pd ) {
							pd.teamId = t.id;
						}
					}
				}
			} ),
			Match.tag( "fish/HandsDealt", ( e ) => {
				draft.hands = castDraft( e.hands );
				draft.cardCounts = castDraft( e.cardCounts );
				draft.cardLocations = castDraft( e.cardLocations );
			} ),
			Match.tag( "fish/CardAsked", ( e ) => applyAsk( draft, e ) ),
			Match.tag( "fish/BookClaimed", ( e ) => applyClaim( draft, e ) ),
			Match.tag( "fish/TurnTransferred", ( e ) => {
				draft.lastMoveType = "transfer";
				draft.transferHistory.unshift( {
					playerId: e.playerId,
					transferTo: e.transferTo,
					timestamp: e.timestamp
				} );
			} ),
			Match.tag( "fish/WinningTeamDecided", ( e ) => { draft.winningTeam = e.teamId; } ),
			Match.exhaustive
		);
	} );
