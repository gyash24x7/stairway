import * as Match from "effect/Match";
import { castDraft, produce } from "immer";

import { CALLBREAK_PLAYER_COUNT, Deal } from "@/games/callbreak/shared/schema.ts";
import { getCardValue } from "@/games/callbreak/shared/utils.ts";
import { generateDeck, generateHands, getCardSuit } from "@/shared/cards/utils.ts";
import { generateId } from "@/shared/utils/generator.ts";

import type { CallbreakEvent, CallbreakState, Trick } from "@/games/callbreak/shared/schema.ts";
import type { CardId, CardSuit } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

// --- Pure reducer ----------------------------------------------------------
// The `apply(state, event)` fold — the ONLY place `state` changes. Mutations are
// on an immer draft; the active deal/trick are always `deals[0]`/`tricks[0]`.

/**
 * Pure reducer — the ONLY place `state` changes. Mutations are on an immer draft.
 *
 * @param state - The current state.
 * @param event - The game event to fold in.
 * @returns The next state.
 */
export const apply = ( state: CallbreakState, event: CallbreakEvent ) =>
	produce( state, ( draft ) => {
		Match.value( event ).pipe(
			Match.tag( "callbreak/ev/ScoreInitialized", ( e ) => {
				draft.scores[ e.playerId ] = 0;
			} ),

			Match.tag( "callbreak/ev/DealDealt", ( e ) => {
				draft.deals.unshift( castDraft( e.deal ) );
			} ),

			Match.tag( "callbreak/ev/WinsDeclared", ( e ) => {
				const deal = draft.deals[ 0 ];
				if ( deal ) {
					deal.declarations[ e.playerId ] = e.wins;
				}
			} ),

			Match.tag( "callbreak/ev/TrickStarted", ( e ) => {
				const deal = draft.deals[ 0 ];
				if ( deal ) {
					deal.tricks.unshift( castDraft( { leadPlayer: e.leadPlayer, cards: {} } ) );
				}
			} ),

			Match.tag( "callbreak/ev/CardPlayed", ( e ) => {
				const deal = draft.deals[ 0 ];
				if ( !deal ) {
					return;
				}

				const hand = deal.hands[ e.playerId ] ?? [];
				deal.hands[ e.playerId ] = hand.filter( ( c ) => c !== e.cardId );

				const trick = deal.tricks[ 0 ];
				if ( !!trick ) {
					trick.cards[ e.playerId ] = e.cardId;
					trick.suit = trick.suit ?? getCardSuit( e.cardId );
				}
			} ),

			Match.tag( "callbreak/ev/TrickWon", ( e ) => {
				const deal = draft.deals[ 0 ];
				if ( !!deal ) {
					const trick = deal.tricks[ 0 ];
					if ( trick ) {
						trick.winner = e.winner;
					}

					deal.wins[ e.winner ] = ( deal.wins[ e.winner ] ?? 0 ) + 1;
				}
			} ),

			Match.tag( "callbreak/ev/DealScored", ( e ) => {
				const deal = draft.deals[ 0 ];
				if ( deal ) {
					Object.assign( deal.scores, e.scores );
				}

				for ( const pid of Object.keys( e.scores ) as PlayerId[] ) {
					const score = draft.scores[ pid ] ?? 0;
					draft.scores[ pid ] = score + ( e.scores[ pid ] ?? 0 );
				}
			} ),

			Match.exhaustive
		);
	} );

// --- Deal dealing ----------------------------------------------------------

/**
 * Who took a trick: the highest trump if any was played, otherwise the highest
 * card of the suit that was led. The lead card seeds the comparison, so a trick
 * whose leader has not played yet has no meaningful answer — the engine only
 * ever asks once the fourth card has landed.
 *
 * @param trick - The trick to settle, with every card in it.
 * @param trump - The game's trump suit.
 * @param players - The seating order to walk.
 * @returns The winning seat.
 */
export function determineTrickWinner(
	trick: Trick,
	trump: CardSuit,
	players: ReadonlyArray<PlayerId>
) {
	let winningPlayer = trick.leadPlayer;
	let winningCard = trick.cards[ trick.leadPlayer ];

	for ( const playerId of players ) {
		const card = trick.cards[ playerId ];
		if ( playerId === trick.leadPlayer || !card ) {
			continue;
		}

		if ( !winningCard ) {
			winningPlayer = playerId;
			winningCard = card;
			continue;
		}

		const cardSuit = getCardSuit( card );
		const winningSuit = getCardSuit( winningCard );

		const beatsWithTrump = cardSuit === trump && winningSuit !== trump;
		const beatsInSuit = cardSuit === winningSuit
			&& getCardValue( card ) > getCardValue( winningCard );

		if ( beatsWithTrump || beatsInSuit ) {
			winningPlayer = playerId;
			winningCard = card;
		}
	}

	return winningPlayer;
}

/**
 * Shuffles a deck and cuts it into four hands, one per seat in seating order.
 *
 * The `rng` is the engine's seeded stream rather than an optional convenience:
 * a deal is dealt inside a phase hook, and a hook that reached for
 * `Math.random` would deal a different game every time the log were replayed.
 *
 * @param players - The seating order to deal to.
 * @param startingPlayer - Who declares first and leads the opening trick.
 * @param rng - The engine's seeded randomness source for this commit.
 * @returns A fresh deal, with every seat's counters zeroed.
 */
export function createNewDeal(
	players: ReadonlyArray<PlayerId>,
	startingPlayer: PlayerId,
	rng: () => number
) {
	const deck = generateDeck( rng );
	const generatedHands = generateHands( deck, CALLBREAK_PLAYER_COUNT );

	return Deal.make( {
		id: generateId(),
		startingPlayer,
		tricks: [],
		...players.reduce(
			( acc, playerId, index ) => {
				acc.hands[ playerId ] = generatedHands[ index ] ?? [];
				acc.declarations[ playerId ] = 0;
				acc.wins[ playerId ] = 0;
				acc.scores[ playerId ] = 0;
				return acc;
			},
			{
				declarations: {} as Record<PlayerId, number>,
				wins: {} as Record<PlayerId, number>,
				scores: {} as Record<PlayerId, number>,
				hands: {} as Record<PlayerId, CardId[]>
			}
		)
	} );
}

// --- Scoring and standings -------------------------------------------------

/**
 * What one deal is worth to a seat, in tenths of a point so the whole game
 * stays in integers. Making the call pays the call itself plus two tenths for
 * each overtrick; missing it costs the call outright, overtricks or not.
 *
 * @param call - What the seat declared.
 * @param won - How many tricks it actually took.
 * @returns The deal's score, in tenths of a point.
 */
export function calculateRoundScore( call: number, won: number ) {
	return won >= call ? call * 10 + 2 * ( won - call ) : -call * 10;
}

/**
 * The roster ranked best-first by running total. `toSorted` is stable, so seats
 * level on score keep their seating order rather than being reordered by an
 * arbitrary tie-break the game does not have.
 *
 * @param players - The roster, in seating order.
 * @param scores - Every seat's running total.
 * @returns The roster, best first.
 */
export function rankPlayers(
	players: ReadonlyArray<PlayerId>,
	scores: CallbreakState[ "scores" ]
) {
	return players.toSorted( ( a, b ) => ( scores[ b ] ?? 0 ) - ( scores[ a ] ?? 0 ) );
}

/**
 * The winner: the top of {@link rankPlayers}, but only when it *is* a top.
 * Callbreak has no tie-break — two seats finishing level have won together — so
 * a dead heat names nobody rather than picking whoever sat down first.
 *
 * @param players - The roster, in seating order.
 * @param scores - Every seat's running total.
 * @returns The single winning seat, or `undefined` when the top is shared.
 */
export function decideWinner(
	players: ReadonlyArray<PlayerId>,
	scores: CallbreakState[ "scores" ]
) {
	const [ top, runnerUp ] = rankPlayers( players, scores );
	if ( !top ) {
		return undefined;
	}

	const tied = runnerUp !== undefined && ( scores[ top ] ?? 0 ) === ( scores[ runnerUp ] ?? 0 );
	return tied ? undefined : top;
}

/**
 * The final table: seats best-first, each stamped with its total and its place.
 * Ranking is standard competition style — seats level on score share a place and
 * the next one down skips it — which is what makes a shared victory read as two
 * seats at rank 1 with no winner named.
 *
 * @param players - The roster, in seating order.
 * @param scores - Every seat's running total.
 * @returns The standings the engine records on the completed game.
 */
export function standingsFor(
	players: ReadonlyArray<PlayerId>,
	scores: CallbreakState[ "scores" ]
) {
	let rank = 1;
	let previous: PlayerId | undefined;

	const ranking = rankPlayers( players, scores ).map( ( playerId, index ) => {
		if ( previous !== undefined && ( scores[ previous ] ?? 0 ) !== ( scores[ playerId ] ?? 0 ) ) {
			rank = index + 1;
		}

		previous = playerId;
		return { playerId, rank, score: scores[ playerId ] ?? 0 };
	} );

	return { ranking, winner: decideWinner( players, scores ) };
}
