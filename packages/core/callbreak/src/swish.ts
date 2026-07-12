// @s2h/callbreak/swish — Callbreak as an event-sourced swish game.
//
// The swish port of ./engine.ts (the old phased `AbstractGameEngine` DO). Same
// rules, re-expressed under event sourcing: moves/hooks/phase-transitions EMIT
// domain events and a pure `apply` reducer folds them onto `state` (the only
// place state changes). The pure helpers in ./utils and the bot in ./bot are
// reused as-is.
//
// Callbreak is PHASED: each round cycles DECLARING -> PLAYING, repeated for
// `config.dealCount` rounds, with per-round + cumulative scoring. The two
// nondeterministic events (dealing a round's hands) are computed once in the
// DECLARING phase `onEnter` (via `createNewDeal`, which shuffles) and the exact
// dealt deal is captured in the emitted `DealDealt` event so replay is exact.

import { Effect, Match, Schema } from "effect";
import { RpcGroup } from "effect/unstable/rpc";
import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { PlayerId } from "@s2h/swish/schema";
import { definePhasedGame, type ReadonlyGameData } from "@s2h/swish/structure";
import { CARD_SUITS, type CardId, getCardSuit, SORTED_DECK } from "@s2h/utils/cards";
import { botDeclare, botPlayCard } from "./bot";
import type { CallbreakBotView } from "./types";
import {
	calculateRoundScore,
	createNewDeal,
	determineTrickWinner,
	getPlayableCards,
	PLAYER_COUNT,
	TRICKS_PER_DEAL
} from "./utils";

// --- Schemas ---------------------------------------------------------------

const CardIdSchema = Schema.Literals( SORTED_DECK );
const CardSuitSchema = Schema.Literals( Object.values( CARD_SUITS ) );
const ScoreMap = Schema.Record( PlayerId, Schema.Number );
const CountMap = Schema.Record( PlayerId, Schema.Number );

const Trick = Schema.Struct( {
	leadPlayer: PlayerId,
	suit: Schema.optional( CardSuitSchema ),
	cards: Schema.Record( PlayerId, CardIdSchema ),
	winner: Schema.optional( PlayerId )
} );

const Deal = Schema.Struct( {
	id: Schema.String,
	startingPlayer: PlayerId,
	hands: Schema.Record( PlayerId, Schema.Array( CardIdSchema ) ),
	declarations: CountMap,
	wins: CountMap,
	scores: ScoreMap,
	tricks: Schema.Array( Trick )
} );

/** A deal without the private per-player hands (shared-view shape). */
const PublicDeal = Schema.Struct( {
	id: Schema.String,
	startingPlayer: PlayerId,
	declarations: CountMap,
	wins: CountMap,
	scores: ScoreMap,
	tricks: Schema.Array( Trick )
} );

export const CallbreakConfig = Schema.Struct( {
	playerCount: Schema.Number,
	autoStart: Schema.optional( Schema.Boolean ),
	dealCount: Schema.Number,
	trumpSuit: CardSuitSchema
} );

export const CallbreakState = Schema.Struct( {
	deals: Schema.Array( Deal ),
	scores: ScoreMap,
	winner: Schema.optional( PlayerId )
} );

/** Shared view: cumulative scores, the active deal (hands hidden) + last trick. */
export const CallbreakShared = Schema.Struct( {
	scores: ScoreMap,
	activeDeal: Schema.optional( PublicDeal ),
	lastCompletedTrick: Schema.optional( Trick ),
	winner: Schema.optional( PlayerId )
} );

/** Player view: the player's own hand only. */
export const CallbreakPlayer = Schema.Struct( {
	playerId: PlayerId,
	hand: Schema.Array( CardIdSchema )
} );

export const DeclareWinsInput = Schema.Struct( {
	wins: Schema.Number,
	dealId: Schema.String
} );
export const PlayCardInput = Schema.Struct( {
	cardId: CardIdSchema,
	dealId: Schema.String
} );

type CallbreakStateType = typeof CallbreakState.Type;
type CallbreakConfigType = typeof CallbreakConfig.Type;
type DealType = typeof Deal.Type;
type TrickType = typeof Trick.Type;
/** The read-only snapshot every callbreak game function receives. */
type Data = ReadonlyGameData<CallbreakStateType, CallbreakConfigType>;

// --- Domain events + reducer -----------------------------------------------

/** A player joined; seed their cumulative score at 0. */
const ScoreInitialized = Schema.TaggedStruct( "callbreak/ScoreInitialized", { playerId: PlayerId } );
/** A new round was dealt; the full (shuffled) deal is captured for exact replay. */
const DealDealt = Schema.TaggedStruct( "callbreak/DealDealt", { deal: Deal } );
/** A player declared their target number of wins for the active deal. */
const WinsDeclared = Schema.TaggedStruct( "callbreak/WinsDeclared", {
	playerId: PlayerId,
	wins: Schema.Number
} );
/** A fresh trick began, led by `leadPlayer`. */
const TrickStarted = Schema.TaggedStruct( "callbreak/TrickStarted", { leadPlayer: PlayerId } );
/** A card was played into the active trick by `playerId`. */
const CardPlayed = Schema.TaggedStruct( "callbreak/CardPlayed", {
	playerId: PlayerId,
	cardId: CardIdSchema
} );
/** The active trick completed; `winner` took it. */
const TrickWon = Schema.TaggedStruct( "callbreak/TrickWon", { winner: PlayerId } );
/** The active deal finished; per-player round scores are applied + accumulated. */
const DealScored = Schema.TaggedStruct( "callbreak/DealScored", { scores: ScoreMap } );
/** The game ended; `winner` had the highest cumulative score. */
const WinnerDecided = Schema.TaggedStruct( "callbreak/WinnerDecided", { winner: PlayerId } );

const CallbreakEvent = Schema.Union( [
	ScoreInitialized,
	DealDealt,
	WinsDeclared,
	TrickStarted,
	CardPlayed,
	TrickWon,
	DealScored,
	WinnerDecided
] );
type CallbreakEvent = typeof CallbreakEvent.Type;

/** Replace deal 0 (the active deal) with a patched copy. Pure. */
const patchActiveDeal = (
	state: CallbreakStateType,
	patch: ( deal: DealType ) => DealType
): CallbreakStateType => {
	const [ active, ...rest ] = state.deals;
	if ( !active ) {
		return state;
	}
	return { ...state, deals: [ patch( active ), ...rest ] };
};

/** Replace trick 0 (the active trick) of the active deal with a patched copy. Pure. */
const patchActiveTrick = (
	state: CallbreakStateType,
	patch: ( trick: TrickType ) => TrickType
): CallbreakStateType =>
	patchActiveDeal( state, ( deal ) => {
		const [ active, ...rest ] = deal.tricks;
		if ( !active ) {
			return deal;
		}
		return { ...deal, tricks: [ patch( active ), ...rest ] };
	} );

/** Pure reducer — the ONLY place `state` changes. */
const apply = ( state: CallbreakStateType, event: CallbreakEvent ): CallbreakStateType =>
	Match.value( event ).pipe(
		Match.tag( "callbreak/ScoreInitialized", ( e ) =>
			( { ...state, scores: { ...state.scores, [ e.playerId ]: 0 } } ) ),
		Match.tag( "callbreak/DealDealt", ( e ) => ( { ...state, deals: [ e.deal, ...state.deals ] } ) ),
		Match.tag( "callbreak/WinsDeclared", ( e ) =>
			patchActiveDeal( state, ( deal ) =>
				( { ...deal, declarations: { ...deal.declarations, [ e.playerId ]: e.wins } } ) ) ),
		Match.tag( "callbreak/TrickStarted", ( e ) =>
			patchActiveDeal( state, ( deal ) =>
				( { ...deal, tricks: [ { leadPlayer: e.leadPlayer, cards: {} } as TrickType, ...deal.tricks ] } ) ) ),
		Match.tag( "callbreak/CardPlayed", ( e ) =>
			patchActiveDeal( state, ( deal ) => {
				const hand = ( deal.hands[ e.playerId ] ?? [] ).filter( ( c ) => c !== e.cardId );
				const hands = { ...deal.hands, [ e.playerId ]: hand };
				const [ active, ...rest ] = deal.tricks;
				if ( !active ) {
					return { ...deal, hands };
				}
				const trick: TrickType = {
					...active,
					cards: { ...active.cards, [ e.playerId ]: e.cardId },
					suit: active.suit ?? getCardSuit( e.cardId )
				};
				return { ...deal, hands, tricks: [ trick, ...rest ] };
			} ) ),
		Match.tag( "callbreak/TrickWon", ( e ) => {
			const withWinner = patchActiveTrick( state, ( trick ) => ( { ...trick, winner: e.winner } ) );
			return patchActiveDeal( withWinner, ( deal ) =>
				( { ...deal, wins: { ...deal.wins, [ e.winner ]: ( deal.wins[ e.winner ] ?? 0 ) + 1 } } ) );
		} ),
		Match.tag( "callbreak/DealScored", ( e ) => {
			const withDealScores = patchActiveDeal( state, ( deal ) =>
				( { ...deal, scores: { ...deal.scores, ...e.scores } } ) );
			const scores: Record<string, number> = { ...withDealScores.scores };
			for ( const [ pid, delta ] of Object.entries( e.scores ) ) {
				scores[ pid ] = ( scores[ pid ] ?? 0 ) + delta;
			}
			return { ...withDealScores, scores };
		} ),
		Match.tag( "callbreak/WinnerDecided", ( e ) => ( { ...state, winner: e.winner } ) ),
		Match.exhaustive
	);

// --- Engine ----------------------------------------------------------------

export const callbreak = makeEngine(
	definePhasedGame( {
		name: "callbreak",
		stateSchema: CallbreakState,
		configSchema: CallbreakConfig,
		sharedViewSchema: CallbreakShared,
		playerViewSchema: CallbreakPlayer,
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
				Effect.succeed( [ ScoreInitialized.make( { playerId } ) ] ),
			// The winner is the player with the highest cumulative score.
			onEnd: ( { state, context } ) => {
				const winner = context.players.reduce( ( best, pid ) =>
					( state.scores[ pid ] ?? 0 ) > ( state.scores[ best ] ?? 0 ) ? pid : best
				);
				return Effect.succeed( [ WinnerDecided.make( { winner } ) ] );
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
					const deal = createNewDeal( [ ...context.players ], startingPlayer ) as unknown as DealType;
					return Effect.succeed( [ DealDealt.make( { deal } ) ] );
				},

				resolveStartingPlayer: ( { state } ) =>
					Effect.succeed( state.deals[ 0 ]!.startingPlayer ),

				moves: {
					declareWins: {
						input: DeclareWinsInput,
						validate: ( { state }: Data, playerId: PlayerId, input: typeof DeclareWinsInput.Type ) => {
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
						execute: ( _data: Data, playerId: PlayerId, input: typeof DeclareWinsInput.Type ) =>
							Effect.succeed( [ WinsDeclared.make( { playerId, wins: input.wins } ) ] )
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
					Effect.succeed( [ TrickStarted.make( { leadPlayer: state.deals[ 0 ]!.startingPlayer } ) ] ),

				resolveStartingPlayer: ( { state } ) =>
					Effect.succeed( state.deals[ 0 ]!.startingPlayer ),

				moves: {
					playCard: {
						input: PlayCardInput,
						validate: ( { state, config }: Data, playerId: PlayerId, input: typeof PlayCardInput.Type ) => {
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
						execute: ( { state, config, context }: Data, playerId: PlayerId, input: typeof PlayCardInput.Type ) => {
							const events: Array<typeof CallbreakEvent.Type> = [
								CardPlayed.make( { playerId, cardId: input.cardId } )
							];
							const activeDeal = state.deals[ 0 ]!;
							const activeTrick = activeDeal.tricks[ 0 ]!;
							// This card completes the trick — decide the winner now. The
							// projected trick includes the just-played card + resolved suit.
							if ( Object.keys( activeTrick.cards ).length + 1 >= PLAYER_COUNT ) {
								const projected: TrickType = {
									...activeTrick,
									cards: { ...activeTrick.cards, [ playerId ]: input.cardId },
									suit: activeTrick.suit ?? getCardSuit( input.cardId )
								};
								const winner = determineTrickWinner(
									projected as never,
									config.trumpSuit,
									[ ...context.players ]
								) as PlayerId;
								events.push( TrickWon.make( { winner } ) );
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
							return Effect.succeed( [ TrickStarted.make( { leadPlayer: activeTrick.winner } ) ] );
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
					return Effect.succeed( [ DealScored.make( { scores } ) ] );
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
	EngineRpc.makeGetState( CallbreakShared, CallbreakPlayer ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "declareWins", DeclareWinsInput ),
	EngineRpc.makeForMove( "playCard", PlayCardInput ),
	EngineRpc.makeUndo( CallbreakShared, CallbreakPlayer ),
	EngineRpc.makeRedo( CallbreakShared, CallbreakPlayer )
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
