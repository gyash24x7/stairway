import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { CardId, CardSuit } from "@/shared/cards/schema.ts";
import { BaseGameConfig, InitializeInput, PlayerId, PositiveInt } from "@/swish/shared/schema.ts";


// --- Constants ----------------------------------------------

/**
 * Callbreak is a fixed four-hand game: the deck deals 13 cards to exactly four
 * seats and every trick rule assumes that. Pinned in the schema so an invalid
 * count is rejected at the API boundary rather than dealing a broken game.
 */
export const CALLBREAK_PLAYER_COUNT = 4;

/**
 * Tricks in one deal — 52 cards over four seats. Doubles as the upper bound on a
 * declaration: you cannot bid more tricks than the deal contains.
 */
export const CALLBREAK_TRICKS_PER_DEAL = 13;

/**
 * The lowest a seat may declare. It is also the sentinel the declaring phase
 * reads: a seat's declaration is `0` until it makes one, so `1` has to be a
 * legal bid and `0` must never be.
 */
export const CALLBREAK_MIN_DECLARATION = 1;

/**
 * The deal counts the lobby offers. A table plays a fixed number of deals and
 * then ranks the seats by their running total, so `0` (a game that never
 * finishes a deal) and an unbounded count are both off the menu.
 */
export const CALLBREAK_DEAL_COUNTS = [ 5, 9, 13 ] as const;

/** How long a seat may hold its turn before the clock hands it to the policy. */
export const CALLBREAK_MOVE_TIMEOUT_MILLIS = 60_000;


// --- Primitives ----------------------------------------------

/**
 * One trick in progress or complete.
 * - leadPlayer: The seat that opened it, and the one every follow is measured from
 * - suit: The suit led, filled in by the opening card
 * - cards: What each seat played into it
 * - winner: Who took it, set the moment the fourth card lands
 */
export type Trick = typeof Trick.Type;
export const Trick = Schema.Struct( {
	leadPlayer: PlayerId,
	suit: Schema.optional( CardSuit ),
	cards: Schema.Record( PlayerId, CardId ),
	winner: Schema.optional( PlayerId )
} );

/**
 * One deal: the hands it dealt, what each seat called, and how it went.
 * - id: Identifies the deal, so a move names the deal it is playing into
 * - startingPlayer: Who declares first and leads the opening trick
 * - hands: Every seat's cards — the only private region in the game
 * - declarations: What each seat called; `0` until it calls
 * - wins: Tricks taken so far
 * - scores: The deal's own scores, filled in when it is scored
 * - tricks: Newest first, so `tricks[ 0 ]` is the one being played
 */
export type Deal = typeof Deal.Type;
export const Deal = Schema.Struct( {
	id: Schema.NonEmptyString,
	startingPlayer: PlayerId,
	hands: Schema.Record( PlayerId, Schema.Array( CardId ) ),
	declarations: Schema.Record( PlayerId, PositiveInt ),
	wins: Schema.Record( PlayerId, PositiveInt ),
	scores: Schema.Record( PlayerId, Schema.Int ),
	tricks: Schema.Array( Trick )
} );

/** A deal with the hands taken out — everything about it the whole table sees. */
export type PublicDeal = typeof PublicDeal.Type;
export const PublicDeal = Schema.Struct( {
	...Deal.mapFields( Struct.omit( [ "hands" ] ) ).fields
} );

export type DealCount = typeof DealCount.Type;
export const DealCount = Schema.Literals( CALLBREAK_DEAL_COUNTS );


// --- Config / State / Views ------------------------------------------------------

/**
 * The `POST /create` payload: only the round shape is the player's to choose.
 * The four seats, the move clock and `autoStart` are server-side constants, so
 * they are absent here and filled in by the handler. `dealCount` is pinned to
 * the lengths the lobby offers.
 */
export type CallbreakCreateInput = typeof CallbreakCreateInput.Type;
export const CallbreakCreateInput = Schema.Struct( {
	dealCount: DealCount,
	trumpSuit: CardSuit
} );

export type CallbreakConfig = typeof CallbreakConfig.Type;
export const CallbreakConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	...CallbreakCreateInput.fields,
	playerCount: Schema.Literal( CALLBREAK_PLAYER_COUNT )
} );

/**
 * The authoritative state.
 * - deals: Newest first, so `deals[ 0 ]` is the deal being played
 * - scores: The running total across every scored deal, in tenths of a point
 *
 * How the game came out is deliberately not here. That is `Standings`, which the
 * engine stamps onto the record from `resolveResults` and every `GameView`
 * carries — a second copy folded into the state could only ever disagree with
 * it, and did: the event that was supposed to set it was never emitted, so the
 * field went out `undefined` on every finished game.
 */
export type CallbreakState = typeof CallbreakState.Type;
export const CallbreakState = Schema.Struct( {
	deals: Schema.Array( Deal ),
	scores: Schema.Record( PlayerId, Schema.Int )
} );

/**
 * One shape for every audience. The only thing a Callbreak table hides is the
 * cards in the four hands, so those go out as `handCounts` — every seat's size,
 * the table's included — and `hand` carries the cards of whichever seat the view
 * was built for. A spectator gets the same shape with `hand` empty and
 * `playerId` unset, so one renderer serves players and onlookers alike.
 *
 * Only the deal in play is projected: the finished ones live on in `scores` and
 * in `dealsPlayed` — the count is what tells a client how far through the table
 * is, which the one projected deal cannot say on its own.
 */
export type CallbreakView = typeof CallbreakView.Type;
export const CallbreakView = Schema.Struct( {
	...CallbreakState.mapFields( Struct.omit( [ "deals" ] ) ).fields,
	activeDeal: Schema.optional( PublicDeal ),
	dealsPlayed: PositiveInt,
	handCounts: Schema.Record( PlayerId, PositiveInt ),
	lastCompletedTrick: Schema.optional( Trick ),
	playerId: Schema.optional( PlayerId ),
	hand: Schema.Array( CardId )
} );


// --- Move Inputs ------------------------------------------------------

export type DeclareWinsInput = typeof DeclareWinsInput.Type;
export const DeclareWinsInput = Schema.Struct( {
	wins: Schema.Number.check(
		Schema.isInt(),
		Schema.isBetween( {
			minimum: CALLBREAK_MIN_DECLARATION,
			maximum: CALLBREAK_TRICKS_PER_DEAL
		} )
	),
	dealId: Schema.NonEmptyString
} );

export type PlayCardInput = typeof PlayCardInput.Type;
export const PlayCardInput = Schema.Struct( {
	cardId: CardId,
	dealId: Schema.NonEmptyString
} );

export type CallbreakInitializeInput = typeof CallbreakInitializeInput.Type;
export const CallbreakInitializeInput = InitializeInput( CallbreakConfig );


// --- Domain Events ---------------------------------------------------------

export type ScoreInitializedEvent = typeof ScoreInitializedEvent.Type;
export const ScoreInitializedEvent = Schema.TaggedStruct( "callbreak/ev/ScoreInitialized", {
	playerId: PlayerId
} );

export type DealDealtEvent = typeof DealDealtEvent.Type;
export const DealDealtEvent = Schema.TaggedStruct( "callbreak/ev/DealDealt", { deal: Deal } );

export type WinsDeclaredEvent = typeof WinsDeclaredEvent.Type;
export const WinsDeclaredEvent = Schema.TaggedStruct( "callbreak/ev/WinsDeclared", {
	playerId: PlayerId,
	wins: PositiveInt
} );

export type TrickStartedEvent = typeof TrickStartedEvent.Type;
export const TrickStartedEvent = Schema.TaggedStruct( "callbreak/ev/TrickStarted", {
	leadPlayer: PlayerId
} );

export type CardPlayedEvent = typeof CardPlayedEvent.Type;
export const CardPlayedEvent = Schema.TaggedStruct( "callbreak/ev/CardPlayed", {
	playerId: PlayerId,
	cardId: CardId
} );

export type TrickWonEvent = typeof TrickWonEvent.Type;
export const TrickWonEvent = Schema.TaggedStruct( "callbreak/ev/TrickWon", { winner: PlayerId } );

export type DealScoredEvent = typeof DealScoredEvent.Type;
export const DealScoredEvent = Schema.TaggedStruct( "callbreak/ev/DealScored", {
	scores: Schema.Record( PlayerId, Schema.Int )
} );

export type CallbreakEvent = typeof CallbreakEvent.Type;
export const CallbreakEvent = Schema.Union( [
	ScoreInitializedEvent,
	DealDealtEvent,
	WinsDeclaredEvent,
	TrickStartedEvent,
	CardPlayedEvent,
	TrickWonEvent,
	DealScoredEvent
] );
