import { BaseGameConfig, type BaseGameData, GameSnapshot, PlayerId } from "@s2h/swish/schema";
import { CARD_SUITS, SORTED_DECK } from "@s2h/utils/cards";
import * as Schema from "effect/Schema";

// --- Card / primitive schemas ----------------------------------------------

export type CardIdSchema = typeof CardIdSchema.Type;
export const CardIdSchema = Schema.Literals( SORTED_DECK );

export type CardSuitSchema = typeof CardSuitSchema.Type;
export const CardSuitSchema = Schema.Literals( Object.values( CARD_SUITS ) );

const ScoreMap = Schema.Record( PlayerId, Schema.Number );
const CountMap = Schema.Record( PlayerId, Schema.Number );

// --- Domain structs --------------------------------------------------------

/** A single trick in a deal, tracking lead player, suit, cards played, and winner. */
export type Trick = typeof Trick.Type;
export const Trick = Schema.Struct( {
	leadPlayer: PlayerId,
	suit: Schema.optional( CardSuitSchema ),
	cards: Schema.Record( PlayerId, CardIdSchema ),
	winner: Schema.optional( PlayerId )
} );

/** A complete deal containing hands, declarations, wins, scores, and tricks. */
export type Deal = typeof Deal.Type;
export const Deal = Schema.Struct( {
	id: Schema.String,
	startingPlayer: PlayerId,
	hands: Schema.Record( PlayerId, Schema.Array( CardIdSchema ) ),
	declarations: CountMap,
	wins: CountMap,
	scores: ScoreMap,
	tricks: Schema.Array( Trick )
} );

/** A deal without the private per-player hands (shared-view shape). */
export type PublicDeal = typeof PublicDeal.Type;
export const PublicDeal = Schema.Struct( {
	id: Schema.String,
	startingPlayer: PlayerId,
	declarations: CountMap,
	wins: CountMap,
	scores: ScoreMap,
	tricks: Schema.Array( Trick )
} );

// --- Config / state / views ------------------------------------------------

export type CallbreakConfig = typeof CallbreakConfig.Type;
export const CallbreakConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	dealCount: Schema.Number,
	trumpSuit: CardSuitSchema
} );

/** Server-side game state containing all deals and cumulative scores. */
export type CallbreakState = typeof CallbreakState.Type;
export const CallbreakState = Schema.Struct( {
	deals: Schema.Array( Deal ),
	scores: ScoreMap,
	winner: Schema.optional( PlayerId )
} );

/** Shared view: cumulative scores, the active deal (hands hidden) + last trick. */
export type CallbreakSharedView = typeof CallbreakSharedView.Type;
export const CallbreakSharedView = Schema.Struct( {
	scores: ScoreMap,
	activeDeal: Schema.optional( PublicDeal ),
	lastCompletedTrick: Schema.optional( Trick ),
	winner: Schema.optional( PlayerId )
} );

/** Player view: the player's own hand only. */
export type CallbreakPlayerView = typeof CallbreakPlayerView.Type;
export const CallbreakPlayerView = Schema.Struct( {
	playerId: PlayerId,
	hand: Schema.Array( CardIdSchema )
} );

/** Merged view used by bot AI (shared + player-specific state). */
export type CallbreakBotView = typeof CallbreakBotView.Type;
export const CallbreakBotView = Schema.Struct( {
	...CallbreakSharedView.fields,
	...CallbreakPlayerView.fields
} );

/**
 * The single audience view: cumulative scores + the active deal (hands hidden),
 * plus `playerId` + own `hand` for a Player audience (both absent for the
 * Table / spectator audience).
 */
export type CallbreakView = typeof CallbreakView.Type;
export const CallbreakView = Schema.Struct( {
	...CallbreakSharedView.fields,
	playerId: Schema.optional( PlayerId ),
	hand: Schema.optional( Schema.Array( CardIdSchema ) )
} );

export type CallbreakSnapshot = typeof CallbreakSnapshot.Type;
export const CallbreakSnapshot = GameSnapshot( CallbreakView, CallbreakConfig );

// --- Move inputs -----------------------------------------------------------

/** Input for declaring the number of tricks a player expects to win. */
export type DeclareWinsInput = typeof DeclareWinsInput.Type;
export const DeclareWinsInput = Schema.Struct( {
	wins: Schema.Number,
	dealId: Schema.String
} );

/** Input for playing a card in the current trick. */
export type PlayCardInput = typeof PlayCardInput.Type;
export const PlayCardInput = Schema.Struct( {
	cardId: CardIdSchema,
	dealId: Schema.String
} );

// --- Domain events ---------------------------------------------------------

/** A player joined; seed their cumulative score at 0. */
export type ScoreInitializedEvent = typeof ScoreInitializedEvent.Type;
export const ScoreInitializedEvent = Schema.TaggedStruct( "callbreak/ScoreInitialized", {
	playerId: PlayerId
} );

/** A new round was dealt; the full (shuffled) deal is captured for exact replay. */
export type DealDealtEvent = typeof DealDealtEvent.Type;
export const DealDealtEvent = Schema.TaggedStruct( "callbreak/DealDealt", { deal: Deal } );

/** A player declared their target number of wins for the active deal. */
export type WinsDeclaredEvent = typeof WinsDeclaredEvent.Type;
export const WinsDeclaredEvent = Schema.TaggedStruct( "callbreak/WinsDeclared", {
	playerId: PlayerId,
	wins: Schema.Number
} );

/** A fresh trick began, led by `leadPlayer`. */
export type TrickStartedEvent = typeof TrickStartedEvent.Type;
export const TrickStartedEvent = Schema.TaggedStruct( "callbreak/TrickStarted", {
	leadPlayer: PlayerId
} );

/** A card was played into the active trick by `playerId`. */
export type CardPlayedEvent = typeof CardPlayedEvent.Type;
export const CardPlayedEvent = Schema.TaggedStruct( "callbreak/CardPlayed", {
	playerId: PlayerId,
	cardId: CardIdSchema
} );

/** The active trick completed; `winner` took it. */
export type TrickWonEvent = typeof TrickWonEvent.Type;
export const TrickWonEvent = Schema.TaggedStruct( "callbreak/TrickWon", { winner: PlayerId } );

/** The active deal finished; per-player round scores are applied + accumulated. */
export type DealScoredEvent = typeof DealScoredEvent.Type;
export const DealScoredEvent = Schema.TaggedStruct( "callbreak/DealScored", { scores: ScoreMap } );

/** The game ended; `winner` had the highest cumulative score. */
export type WinnerDecidedEvent = typeof WinnerDecidedEvent.Type;
export const WinnerDecidedEvent = Schema.TaggedStruct( "callbreak/WinnerDecided", {
	winner: PlayerId
} );

export type CallbreakEvent = typeof CallbreakEvent.Type;
export const CallbreakEvent = Schema.Union( [
	ScoreInitializedEvent,
	DealDealtEvent,
	WinsDeclaredEvent,
	TrickStartedEvent,
	CardPlayedEvent,
	TrickWonEvent,
	DealScoredEvent,
	WinnerDecidedEvent
] );

// --- UI data type ----------------------------------------------------------

export type CallbreakData = BaseGameData & {
	config: typeof CallbreakConfig.Type;
	shared: typeof CallbreakSharedView.Type;
	player: typeof CallbreakPlayerView.Type;
};
