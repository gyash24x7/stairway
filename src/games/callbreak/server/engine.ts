import { botDeclare, botPlayCard } from "@/games/callbreak/server/bot.ts";
import {
	apply,
	calculateRoundScore,
	createNewDeal,
	determineTrickWinner,
	standingsFor
} from "@/games/callbreak/server/utils.ts";
import {
	CALLBREAK_PLAYER_COUNT,
	CALLBREAK_TRICKS_PER_DEAL,
	CallbreakConfig,
	CallbreakEvent,
	CallbreakState,
	CallbreakView,
	CardPlayedEvent,
	DealDealtEvent,
	DealScoredEvent,
	DeclareWinsInput,
	PlayCardInput,
	ScoreInitializedEvent,
	TrickStartedEvent,
	TrickWonEvent,
	WinsDeclaredEvent
} from "@/games/callbreak/shared/schema.ts";
import { getPlayableCards } from "@/games/callbreak/shared/utils.ts";
import { getCardSuit } from "@/shared/cards/utils.ts";
import { makeEngine } from "@/swish/server/engine.ts";
import { playerIdFor } from "@/swish/server/utils.ts";
import { InvalidMove } from "@/swish/shared/schema.ts";

import type { Deal, Trick } from "@/games/callbreak/shared/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";


const fail = ( move: string, reason: string ) => new InvalidMove( { move, reason } );

/**
 * How many of a deal's tricks have been taken. A deal is over — and therefore
 * scorable — exactly when this reaches {@link CALLBREAK_TRICKS_PER_DEAL}.
 *
 * @param deal - The deal to count.
 * @returns The number of settled tricks.
 */
const completedTricks = ( deal: Deal ) => deal.tricks.filter( trick => !!trick.winner ).length;

/**
 * Whether a deal has been played to the end.
 * @param deal - The deal to check.
 * @returns `true` once all 13 tricks have been taken.
 */
const isDealComplete = ( deal: Deal ) => completedTricks( deal ) >= CALLBREAK_TRICKS_PER_DEAL;

/**
 * The seat that acts next inside a trick: one along the seating order from
 * whoever led, by however many cards are already down.
 *
 * @param trick - The trick in progress.
 * @param players - The seating order.
 * @returns The seat expected to play the next card.
 */
const nextInTrick = ( trick: Trick, players: ReadonlyArray<PlayerId> ) => {
	const leadIndex = Math.max( 0, players.indexOf( trick.leadPlayer ) );
	const played = Object.keys( trick.cards ).length;
	return players[ ( leadIndex + played ) % players.length ]!;
};


// --- Engine ----------------------------------------------------------------

export const callbreak = makeEngine( {
	name: "callbreak",
	schemas: {
		state: CallbreakState,
		config: CallbreakConfig,
		events: CallbreakEvent,
		view: CallbreakView,
		moves: {
			declareWins: DeclareWinsInput,
			playCard: PlayCardInput
		}
	},

	apply,

	setup: () => ( { deals: [], scores: {} } ),

	endIf: ( { state, config } ) => state.deals.filter( isDealComplete ).length >= config.dealCount,

	/**
	 * Final placement by running total across every deal — the same quantity
	 * `onEnd` crowns the winner with, and the game's only ranking key. Callbreak
	 * has no tie-break of its own, so two seats finishing level share a rank and
	 * leave `winner` unset rather than being separated by something invented here.
	 */
	resolveResults: ( { state, context } ) => standingsFor( context.players, state.scores ),

	/**
	 * One shape for every audience. The four hands are the only private region,
	 * so they go out as sizes and the requesting seat's own cards; everything
	 * else about the deal in play — the calls, the tricks taken, the cards on the
	 * table — is public and goes out as it stands.
	 */
	view: ( { state }, audience ) => {
		const playerId = playerIdFor( audience );
		const activeDeal = state.deals[ 0 ];
		const dealsPlayed = state.deals.filter( isDealComplete ).length;

		if ( !activeDeal ) {
			return CallbreakView.make( {
				scores: state.scores,
				dealsPlayed,
				handCounts: {},
				playerId,
				hand: []
			} );
		}

		const { hands, ...deal } = activeDeal;
		const handCounts = Object.fromEntries(
			Object.entries( hands ).map( ( [ id, cards ] ) => [ id, cards.length ] )
		) as Record<PlayerId, number>;

		return CallbreakView.make( {
			activeDeal: deal,
			scores: state.scores,
			dealsPlayed,
			lastCompletedTrick: activeDeal.tricks.find( trick => !!trick.winner ),
			handCounts,
			playerId,
			hand: playerId ? hands[ playerId ] ?? [] : []
		} );
	},

	hooks: {
		onJoin: ( _data, playerId ) => [ ScoreInitializedEvent.make( { playerId } ) ],

		beforeMove: ( { state } ) => {
			const activeTrick = state.deals[ 0 ]?.tricks[ 0 ];
			return activeTrick?.winner
				? [ TrickStartedEvent.make( { leadPlayer: activeTrick.winner } ) ]
				: [];
		}
	},

	moves: {
		declareWins: {

			validate: ( { state }, playerId, input ) => {
				const activeDeal = state.deals[ 0 ];
				if ( !activeDeal || activeDeal.id !== input.dealId ) {
					return fail( "declareWins", "Active Deal Not Found!" );
				}

				if ( ( activeDeal.declarations[ playerId ] ?? 0 ) > 0 ) {
					return fail( "declareWins", "Already declared wins!" );
				}

				return undefined;
			},

			execute: ( _data, playerId, input ) => [
				WinsDeclaredEvent.make( { playerId, wins: input.wins } )
			]
		},

		playCard: {

			validate: ( { state, config }, playerId, input ) => {
				const activeDeal = state.deals[ 0 ];
				if ( !activeDeal || activeDeal.id !== input.dealId ) {
					return fail( "playCard", "Active Deal Not Found!" );
				}

				const activeTrick = activeDeal.tricks[ 0 ];
				if ( !activeTrick || activeTrick.winner ) {
					return fail( "playCard", "Active Trick Not Found!" );
				}

				if ( activeTrick.cards[ playerId ] ) {
					return fail( "playCard", "Already played card!" );
				}

				const hand = activeDeal.hands[ playerId ] ?? [];
				if ( !hand.includes( input.cardId ) ) {
					return fail( "playCard", "Card not in hand!" );
				}

				const playable = getPlayableCards( hand, config.trumpSuit, activeTrick );
				if ( !playable.includes( input.cardId ) ) {
					return fail( "playCard", "Card cannot be played!" );
				}

				return undefined;
			},

			execute: ( { state, config, context }, playerId, input ) => {
				const events: Array<CallbreakEvent> = [
					CardPlayedEvent.make( { playerId, cardId: input.cardId } )
				];

				const activeTrick = state.deals[ 0 ]!.tricks[ 0 ]!;

				if ( Object.keys( activeTrick.cards ).length + 1 >= CALLBREAK_PLAYER_COUNT ) {
					const winner = determineTrickWinner(
						{
							...activeTrick,
							cards: { ...activeTrick.cards, [ playerId ]: input.cardId },
							suit: activeTrick.suit ?? getCardSuit( input.cardId )
						},
						config.trumpSuit,
						context.players
					);

					events.push( TrickWonEvent.make( { winner } ) );
				}

				return events;
			}
		}
	},


	/**
	 * The policy's move for whichever seat the engine is waiting on. It runs on
	 * that seat's own view, so it sees exactly what its client does — its own
	 * hand and nothing else — and it dispatches on the phase, since declaring and
	 * playing are the only two things a seat is ever asked for.
	 */
	botMove: ( { state, config, context } ) => {
		const playerId = state.playerId;
		const activeDeal = state.activeDeal;

		if ( !playerId || !activeDeal ) {
			return undefined;
		}

		if ( context.phase === "DECLARING" ) {
			return {
				moveType: "declareWins",
				input: { wins: botDeclare( state, config ), dealId: activeDeal.id }
			};
		}

		return {
			moveType: "playCard",
			input: { cardId: botPlayCard( state, config, playerId ), dealId: activeDeal.id }
		};
	},

	initialPhase: "DECLARING",

	phases: {
		DECLARING: {
			moves: [ "declareWins" ],

			/**
			 * Deals the round. The shuffle is nondeterministic in the sense that it
			 * has never been run before — but the dealt hands ride the `DealDealt`
			 * event, so a replay folds the same deal rather than shuffling again.
			 * The deal after the first is led by the next seat along, so the lead
			 * rotates the table over a game.
			 */
			onEnter: ( { state, context }, rng ) => {
				const previousDeal = state.deals[ 0 ];
				const previousIndex = previousDeal
					? context.players.indexOf( previousDeal.startingPlayer )
					: -1;

				const startingPlayer = context.players[ ( previousIndex + 1 ) % context.players.length ]!;
				const newDeal = createNewDeal( context.players, startingPlayer, rng( "deal" ).next );
				return [ DealDealtEvent.make( { deal: newDeal } ) ];
			},

			resolveStartingPlayer: ( { state } ) => state.deals[ 0 ]!.startingPlayer,

			resolveNextPlayer: ( { state, context } ) => {
				const activeDeal = state.deals[ 0 ]!;
				const startIndex = context.players.indexOf( activeDeal.startingPlayer );

				for ( let i = 0; i < context.players.length; i++ ) {
					const playerId = context.players[ ( startIndex + i ) % context.players.length ]!;
					if ( ( activeDeal.declarations[ playerId ] ?? 0 ) === 0 ) {
						return playerId;
					}
				}

				return activeDeal.startingPlayer;
			},

			endIf: ( { state, context } ) => {
				const activeDeal = state.deals[ 0 ]!;
				return context.players.every(
					playerId => ( activeDeal.declarations[ playerId ] ?? 0 ) > 0
				);
			},

			resolveNextPhase: () => "PLAYING"
		},

		PLAYING: {
			moves: [ "playCard" ],

			onEnter: ( { state } ) => [
				TrickStartedEvent.make( { leadPlayer: state.deals[ 0 ]!.startingPlayer } )
			],

			resolveStartingPlayer: ( { state } ) => state.deals[ 0 ]!.startingPlayer,

			resolveNextPlayer: ( { state, context } ) => {
				const activeTrick = state.deals[ 0 ]?.tricks[ 0 ];
				if ( !activeTrick ) {
					return context.currentPlayer;
				}

				return activeTrick.winner ?? nextInTrick( activeTrick, context.players );
			},

			endIf: ( { state } ) => isDealComplete( state.deals[ 0 ]! ),

			onExit: ( { state, context } ) => {
				const activeDeal = state.deals[ 0 ]!;
				const scores = Object.fromEntries(
					context.players.map( playerId => [
						playerId,
						calculateRoundScore(
							activeDeal.declarations[ playerId ] ?? 0,
							activeDeal.wins[ playerId ] ?? 0
						)
					] )
				) as Record<PlayerId, number>;

				return [ DealScoredEvent.make( { scores } ) ];
			},

			resolveNextPhase: () => "DECLARING"
		}
	}
} );
