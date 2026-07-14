// @s2h/callbreak/engine — Callbreak as an event-sourced swish game.
//
// The swish port of the old phased `AbstractGameEngine` DO. Same rules,
// re-expressed under event sourcing: moves/hooks/phase-transitions EMIT domain
// events and a pure `apply` reducer (in ./utils) folds them onto `state` (the
// only place state changes). The pure helpers in ./utils and the bot in ./bot
// are reused as-is.
//
// Callbreak is PHASED: each round cycles DECLARING -> PLAYING, repeated for
// `config.dealCount` rounds, with per-round + cumulative scoring. The
// nondeterministic event (dealing a round's hands) is computed once in the
// DECLARING phase `onEnter` (via `createNewDeal`, which shuffles) and the exact
// dealt deal is captured in the emitted `DealDealt` event so replay is exact.

import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { PlayerId } from "@s2h/swish/schema";
import { definePhasedGame, type ReadonlyGameData } from "@s2h/swish/structure";
import { type CardId, getCardSuit } from "@s2h/utils/cards";
import * as Effect from "effect/Effect";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { botDeclare, botPlayCard } from "./bot";
import {
	CallbreakConfig,
	type CallbreakBotView,
	CallbreakEvent,
	CallbreakPlayerView,
	CallbreakSharedView,
	CallbreakSnapshot,
	CallbreakState,
	CardPlayedEvent,
	DealDealtEvent,
	DealScoredEvent,
	DeclareWinsInput,
	PlayCardInput,
	ScoreInitializedEvent,
	type Trick,
	TrickStartedEvent,
	TrickWonEvent,
	WinnerDecidedEvent,
	WinsDeclaredEvent
} from "./schema";
import {
	apply,
	calculateRoundScore,
	createNewDeal,
	determineTrickWinner,
	getPlayableCards,
	PLAYER_COUNT,
	TRICKS_PER_DEAL
} from "./utils";

/** The read-only snapshot every callbreak game function receives. */
type Data = ReadonlyGameData<CallbreakState, CallbreakConfig>;

// --- Engine ----------------------------------------------------------------

export const callbreak = makeEngine(
	definePhasedGame( {
		name: "callbreak",
		stateSchema: CallbreakState,
		configSchema: CallbreakConfig,
		sharedViewSchema: CallbreakSharedView,
		playerViewSchema: CallbreakPlayerView,
		eventSchema: CallbreakEvent,
		apply,

		setup: () => Effect.succeed( { deals: [], scores: {} } ),

		// A game ends once `dealCount` rounds have been scored. A deal is scored
		// when any player's per-deal score is non-zero (matches the old engine).
		endIf: ( { state, config } ) => Effect.succeed(
			state.deals.filter( ( d ) => Object.values( d.scores ).some( ( s ) => s !== 0 ) ).length
				>= config.dealCount
		),

		sharedView: ( { state } ) => Effect.succeed( ( () => {
			const activeDeal = state.deals[ 0 ];
			const previousDeal = state.deals[ 1 ];
			const lastCompletedTrick = previousDeal?.tricks[ 0 ];
			if ( activeDeal ) {
				const { hands: _hands, ...deal } = activeDeal;
				return { activeDeal: deal, scores: state.scores, lastCompletedTrick, winner: state.winner };
			}
			return { scores: state.scores, winner: state.winner };
		} )() ),

		playerView: ( { state }, playerId ) =>
			Effect.succeed( { playerId, hand: state.deals[ 0 ]?.hands[ playerId ] ?? [] } ),

		hooks: {
			// Seed each joining player's cumulative score at 0.
			onJoin: ( _data, playerId ) =>
				Effect.succeed( [ ScoreInitializedEvent.make( { playerId } ) ] ),
			// The winner is the player with the highest cumulative score.
			onEnd: ( { state, context } ) => {
				const winner = context.players.reduce( ( best, pid ) =>
					( state.scores[ pid ] ?? 0 ) > ( state.scores[ best ] ?? 0 ) ? pid : best
				);
				return Effect.succeed( [ WinnerDecidedEvent.make( { winner } ) ] );
			}
		},

		initialPhase: "DECLARING",

		phases: {
			DECLARING: {
				// Deal a fresh round. Nondeterministic shuffle happens here and the
				// exact dealt deal is captured in `DealDealt` for exact replay.
				onEnter: ( { state, context } ) => {
					const previousDeal = state.deals[ 0 ];
					let startingPlayer: PlayerId;
					if ( previousDeal ) {
						const startIdx = context.players.indexOf( previousDeal.startingPlayer );
						startingPlayer = context.players[ ( startIdx + 1 ) % context.players.length ]!;
					} else {
						startingPlayer = context.players[ 0 ]!;
					}
					const deal = createNewDeal( [ ...context.players ], startingPlayer );
					return Effect.succeed( [ DealDealtEvent.make( { deal } ) ] );
				},

				resolveStartingPlayer: ( { state } ) =>
					Effect.succeed( state.deals[ 0 ]!.startingPlayer ),

				moves: {
					declareWins: {
						input: DeclareWinsInput,
						validate: ( { state }: Data, playerId: PlayerId, input: DeclareWinsInput ) => {
							const activeDeal = state.deals[ 0 ];
							if ( !activeDeal || activeDeal.id !== input.dealId ) {
								return Effect.fail(
									new InvalidMove( { move: "declareWins", reason: "Active Deal Not Found!" } )
								);
							}
							if ( ( activeDeal.declarations[ playerId ] ?? 0 ) > 0 ) {
								return Effect.fail(
									new InvalidMove( { move: "declareWins", reason: "Already declared wins!" } )
								);
							}
							return Effect.void;
						},
						execute: ( _data: Data, playerId: PlayerId, input: DeclareWinsInput ) =>
							Effect.succeed( [ WinsDeclaredEvent.make( { playerId, wins: input.wins } ) ] )
					}
				},

				resolveNextPlayer: ( { state, context } ) => {
					const activeDeal = state.deals[ 0 ]!;
					const startIdx = context.players.indexOf( activeDeal.startingPlayer );
					for ( let i = 0; i < context.players.length; i++ ) {
						const pid = context.players[ ( startIdx + i ) % context.players.length ]!;
						if ( ( activeDeal.declarations[ pid ] ?? 0 ) === 0 ) {
							return Effect.succeed( pid );
						}
					}
					return Effect.succeed( activeDeal.startingPlayer );
				},

				endIf: ( { state, context } ) => {
					const activeDeal = state.deals[ 0 ]!;
					return Effect.succeed(
						context.players.every( ( pid ) => ( activeDeal.declarations[ pid ] ?? 0 ) > 0 )
					);
				},

				resolveNextPhase: () => Effect.succeed( "PLAYING" ),

				botMove: ( { state, config } ) => {
					const view = state as unknown as CallbreakBotView;
					const wins = botDeclare( view, config );
					return Effect.succeed( {
						moveType: "declareWins" as const,
						input: { wins, dealId: view.activeDeal!.id }
					} );
				}
			},

			PLAYING: {
				// Start the first trick of the round, led by the deal's starter.
				onEnter: ( { state } ) =>
					Effect.succeed( [ TrickStartedEvent.make( { leadPlayer: state.deals[ 0 ]!.startingPlayer } ) ] ),

				resolveStartingPlayer: ( { state } ) =>
					Effect.succeed( state.deals[ 0 ]!.startingPlayer ),

				moves: {
					playCard: {
						input: PlayCardInput,
						validate: ( { state, config }: Data, playerId: PlayerId, input: PlayCardInput ) => {
							const activeDeal = state.deals[ 0 ];
							if ( !activeDeal || activeDeal.id !== input.dealId ) {
								return Effect.fail(
									new InvalidMove( { move: "playCard", reason: "Active Deal Not Found!" } )
								);
							}
							const activeTrick = activeDeal.tricks[ 0 ];
							if ( !activeTrick ) {
								return Effect.fail(
									new InvalidMove( { move: "playCard", reason: "Active Trick Not Found!" } )
								);
							}
							if ( activeTrick.cards[ playerId ] ) {
								return Effect.fail(
									new InvalidMove( { move: "playCard", reason: "Already played card!" } )
								);
							}
							const hand = activeDeal.hands[ playerId ] ?? [];
							if ( !hand.includes( input.cardId ) ) {
								return Effect.fail(
									new InvalidMove( { move: "playCard", reason: "Card not in hand!" } )
								);
							}
							const playable = getPlayableCards( [ ...hand ], config.trumpSuit, activeTrick );
							if ( !playable.includes( input.cardId ) ) {
								return Effect.fail(
									new InvalidMove( { move: "playCard", reason: "Card cannot be played!" } )
								);
							}
							return Effect.void;
						},
						execute: ( { state, config, context }: Data, playerId: PlayerId, input: PlayCardInput ) => {
							const events: Array<CallbreakEvent> = [
								CardPlayedEvent.make( { playerId, cardId: input.cardId } )
							];
							const activeDeal = state.deals[ 0 ]!;
							const activeTrick = activeDeal.tricks[ 0 ]!;
							// This card completes the trick — decide the winner now. The
							// projected trick includes the just-played card + resolved suit.
							if ( Object.keys( activeTrick.cards ).length + 1 >= PLAYER_COUNT ) {
								const projected: Trick = {
									...activeTrick,
									cards: { ...activeTrick.cards, [ playerId ]: input.cardId },
									suit: activeTrick.suit ?? getCardSuit( input.cardId )
								};
								const winner = determineTrickWinner(
									projected,
									config.trumpSuit,
									[ ...context.players ]
								);
								events.push( TrickWonEvent.make( { winner } ) );
							}
							return Effect.succeed( events );
						}
					}
				},

				hooks: {
					// If the previous trick has been won, open a new trick led by the
					// winner before the next card is played.
					beforeMove: ( { state } ) => {
						const activeTrick = state.deals[ 0 ]?.tricks[ 0 ];
						if ( activeTrick?.winner ) {
							return Effect.succeed( [ TrickStartedEvent.make( { leadPlayer: activeTrick.winner } ) ] );
						}
						return Effect.succeed( [] );
					}
				},

				resolveNextPlayer: ( { state, context } ) => {
					const activeTrick = state.deals[ 0 ]?.tricks[ 0 ];
					if ( !activeTrick ) {
						return Effect.succeed( context.players[ 0 ]! );
					}
					if ( activeTrick.winner ) {
						return Effect.succeed( activeTrick.winner );
					}
					const played = Object.keys( activeTrick.cards );
					if ( played.length === 0 ) {
						return Effect.succeed( activeTrick.leadPlayer );
					}
					const lastPlayer = played[ played.length - 1 ]!;
					const lastIdx = context.players.indexOf( lastPlayer as PlayerId );
					return Effect.succeed( context.players[ ( lastIdx + 1 ) % PLAYER_COUNT ]! );
				},

				endIf: ( { state } ) => {
					const activeDeal = state.deals[ 0 ]!;
					const completed = activeDeal.tricks.filter( ( t ) => !!t.winner ).length;
					return Effect.succeed( completed >= TRICKS_PER_DEAL );
				},

				// Score the finished round: per-player round score + accumulate.
				onExit: ( { state, context } ) => {
					const activeDeal = state.deals[ 0 ]!;
					const scores: Record<string, number> = {};
					for ( const pid of context.players ) {
						scores[ pid ] = calculateRoundScore(
							activeDeal.declarations[ pid ] ?? 0,
							activeDeal.wins[ pid ] ?? 0
						);
					}
					return Effect.succeed( [ DealScoredEvent.make( { scores } ) ] );
				},

				resolveNextPhase: () => Effect.succeed( "DECLARING" ),

				botMove: ( { state, config } ) => {
					const view = state as unknown as CallbreakBotView;
					const cardId = botPlayCard( view, config ) as CardId;
					return Effect.succeed( {
						moveType: "playCard" as const,
						input: { cardId, dealId: view.activeDeal!.id }
					} );
				}
			}
		}
	} )
);

// --- RPC surface -----------------------------------------------------------

export class CallbreakRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( CallbreakConfig ),
	EngineRpc.makeGetState( CallbreakSnapshot ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "declareWins", DeclareWinsInput ),
	EngineRpc.makeForMove( "playCard", PlayCardInput ),
	EngineRpc.makeUndo( CallbreakSnapshot ),
	EngineRpc.makeRedo( CallbreakSnapshot )
) {
	public static layer = CallbreakRpcs.toLayer( {
		initialize: callbreak.initialize,
		getState: callbreak.getState,
		join: callbreak.join,
		addBots: callbreak.addBots,
		start: callbreak.start,
		undo: callbreak.undo,
		redo: callbreak.redo,
		declareWins: ( { playerInfo, input } ) => callbreak.submitMove( "declareWins", playerInfo, input ),
		playCard: ( { playerInfo, input } ) => callbreak.submitMove( "playCard", playerInfo, input )
	} );
}
