import * as Match from "effect/Match";
import { castDraft, produce } from "immer";

import {
	CharacterCard,
	COUP_COPIES_PER_CHARACTER
} from "@/games/coup/shared/schema.ts";

import type { CoupEvent, CoupState } from "@/games/coup/shared/schema.ts";
import type { Rng } from "@/shared/utils/rng.ts";
import type { PlayerId, Standings } from "@/swish/shared/schema.ts";


// --- Deck ------------------------------------------------------------------

/**
 * A full deck: three copies of each of the five characters, in a fixed order.
 * Shuffling is the caller's, so the order here is only ever a starting point.
 */
export const freshDeck = () => CharacterCard.literals.flatMap(
	card => Array.from( { length: COUP_COPIES_PER_CHARACTER }, () => card )
);

/**
 * Puts cards back and shuffles the whole pile.
 *
 * The returned cards are mixed into the deck rather than dropped on the bottom
 * of it. With fifteen cards a card that always went to a known position would be
 * trackable, and a proven claim is exactly the moment a player is paying most
 * attention.
 *
 * @param deck - What is left to draw.
 * @param returned - The cards going back.
 * @param rng - The stream to shuffle with.
 * @returns The new deck.
 */
export const returnToDeck = (
	deck: ReadonlyArray<CharacterCard>,
	returned: ReadonlyArray<CharacterCard>,
	rng: Rng
) => rng.shuffle( [ ...deck, ...returned ] );

/**
 * Whether a seat is holding the character it says it is.
 *
 * @param influence - The seat's face-down cards.
 * @param card - The character being claimed.
 * @returns `true` when the claim is honest.
 */
export const holds = ( influence: ReadonlyArray<CharacterCard>, card: CharacterCard ) =>
	influence.includes( card );

/**
 * Removes one copy of a card from a hand, leaving any other copies alone.
 *
 * A hand can hold two of the same character, and turning one over must not take
 * both — which a filter on equality would.
 *
 * @param influence - The seat's face-down cards.
 * @param card - The character to remove one of.
 * @returns The hand, one copy lighter.
 */
export const removeOne = ( influence: ReadonlyArray<CharacterCard>, card: CharacterCard ) => {
	const at = influence.indexOf( card );
	return at < 0
		? [ ...influence ]
		: [ ...influence.slice( 0, at ), ...influence.slice( at + 1 ) ];
};

/**
 * Removes each of `cards` from `pool`, one copy per entry.
 *
 * Used to work out what an exchange puts back: whatever the seat did not keep,
 * counted rather than matched by identity, so keeping one of two Dukes returns
 * the other.
 *
 * @param pool - Everything the seat could have kept.
 * @param cards - What it kept.
 * @returns What goes back to the deck.
 */
export const removeEach = (
	pool: ReadonlyArray<CharacterCard>,
	cards: ReadonlyArray<CharacterCard>
) => cards.reduce<ReadonlyArray<CharacterCard>>( removeOne, pool );

/**
 * Whether every card in `cards` can be taken from `pool`, counting duplicates.
 *
 * @param pool - Everything available.
 * @param cards - What is being taken.
 * @returns `true` when the take is possible.
 */
export const isSubMultiset = (
	pool: ReadonlyArray<CharacterCard>,
	cards: ReadonlyArray<CharacterCard>
) => {
	let rest: ReadonlyArray<CharacterCard> = pool;

	for ( const card of cards ) {
		if ( !rest.includes( card ) ) {
			return false;
		}

		rest = removeOne( rest, card );
	}

	return true;
};


// --- Reading the state -----------------------------------------------------

/** Everyone still holding a card, in the order given. */
export const livingIn = ( state: CoupState, order: ReadonlyArray<PlayerId> ) =>
	order.filter( id => ( state.playerData[ id ]?.influence.length ?? 0 ) > 0 );

/** Whether this seat is still in the game. */
export const isPlaying = ( state: CoupState, playerId: PlayerId | undefined ) =>
	playerId !== undefined && ( state.playerData[ playerId ]?.influence.length ?? 0 ) > 0;


// --- Standings -------------------------------------------------------------

/**
 * How the game came out.
 *
 * Coup has no score, so the ranking is the order people went out in, read
 * backwards: last one standing first, then whoever was knocked out most
 * recently. A seat still holding a card when the game ended but not the winner
 * cannot happen — the game ends precisely when one is left — but the ordering
 * puts any such seat above the eliminated anyway rather than dropping it.
 *
 * @param players - The seating order.
 * @param state - The completed game.
 * @returns The final standings.
 */
export const standingsFor = ( players: ReadonlyArray<PlayerId>, state: CoupState ) => {
	const survivors = livingIn( state, players );
	const knockedOut = [ ...state.eliminationOrder ].reverse();

	const order = [
		...survivors,
		...knockedOut.filter( id => !survivors.includes( id ) ),
		...players.filter( id => !survivors.includes( id ) && !knockedOut.includes( id ) )
	];

	return {
		ranking: order.map( ( playerId, index ) => ( { playerId, rank: index + 1 } ) ),
		...( survivors.length === 1 ? { winner: survivors[ 0 ]! } : {} )
	} satisfies Standings;
};


// --- Reducer ---------------------------------------------------------------

/**
 * The pure reducer. Every change to a coup game passes through here, and
 * nothing else writes to the state.
 *
 * Several events change nothing: a challenge being made, failing or succeeding
 * is a fact the log and the client read, while what it *does* rides the events
 * that come with it — an influence lost, a card swapped, an action fizzled. They
 * are still listed rather than defaulted, so a new event cannot be added without
 * this file deciding what it means.
 *
 * @param state - The current state.
 * @param event - The event to apply.
 * @returns The next state.
 */
export const apply = ( state: CoupState, event: CoupEvent ) => produce( state, ( draft ) => {
	Match.value( event ).pipe(
		Match.tag( "coup/ev/GameDealt", ( e ) => {
			draft.deck = castDraft( e.deck );
			draft.playerData = castDraft(
				Object.fromEntries(
					Object.entries( e.hands ).map( ( [ playerId, influence ] ) => [
						playerId,
						{ coins: e.coins, influence }
					] )
				)
			);
		} ),

		Match.tag( "coup/ev/ActionDeclared", ( e ) => {
			draft.pending = castDraft( e.pending );
		} ),

		Match.tag( "coup/ev/CoinsChanged", ( e ) => {
			const player = draft.playerData[ e.playerId ];
			if ( player ) {
				player.coins = Math.max( 0, player.coins + e.delta );
			}
		} ),

		Match.tag( "coup/ev/CardSwapped", ( e ) => {
			const player = draft.playerData[ e.playerId ];
			if ( player ) {
				player.influence = castDraft( [ ...removeOne( player.influence, e.returned ), e.drawn ] );
			}

			draft.deck = castDraft( e.deck );
		} ),

		Match.tag( "coup/ev/ActionBlocked", ( e ) => {
			if ( draft.pending ) {
				draft.pending.block = { by: e.by, card: e.card };
			}
		} ),

		Match.tag( "coup/ev/InfluenceLost", ( e ) => {
			const player = draft.playerData[ e.playerId ];
			if ( player ) {
				player.influence = castDraft( removeOne( player.influence, e.card ) );
			}

			// The card is named as it goes and then rejoins the deck, so nothing on
			// the table records which characters have been played out.
			draft.deck = castDraft( e.deck );
		} ),

		Match.tag( "coup/ev/PlayerEliminated", ( e ) => {
			if ( !draft.eliminationOrder.includes( e.playerId ) ) {
				draft.eliminationOrder.push( e.playerId );
			}
		} ),

		Match.tag( "coup/ev/ExchangeDrawn", ( e ) => {
			draft.exchangeDraw = castDraft( e.drawn );
			draft.deck = castDraft( e.deck );
		} ),

		Match.tag( "coup/ev/ExchangeCompleted", ( e ) => {
			const player = draft.playerData[ e.playerId ];
			if ( player ) {
				player.influence = castDraft( e.kept );
			}

			draft.exchangeDraw = undefined;
			draft.deck = castDraft( e.deck );
		} ),

		Match.tag( "coup/ev/PendingCleared", () => {
			draft.pending = undefined;
			draft.exchangeDraw = undefined;
		} ),

		Match.tag( "coup/ev/Logged", ( e ) => {
			draft.log.push( castDraft( e.entry ) );
		} ),

		// Announcements. What they mean for the table rides the events emitted
		// alongside them, so there is nothing to fold here.
		Match.tag( "coup/ev/ChallengeMade", () => {} ),
		Match.tag( "coup/ev/ChallengeFailed", () => {} ),
		Match.tag( "coup/ev/ChallengeSucceeded", () => {} ),
		Match.tag( "coup/ev/ActionResolved", () => {} ),
		Match.tag( "coup/ev/ActionFizzled", () => {} ),

		Match.exhaustive
	);
} );
