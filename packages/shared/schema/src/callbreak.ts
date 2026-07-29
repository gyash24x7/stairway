import {
	BaseGameConfig,
	GameSnapshot,
	InitializeInput,
	MovePayload,
	PlayerId
} from "@s2h/swish/schema";
import { CARD_SUITS, SORTED_DECK } from "@s2h/utils/cards";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";


// --- Primitives ----------------------------------------------

export type CardIdSchema = typeof CardIdSchema.Type;
export const CardIdSchema = Schema.Literals( SORTED_DECK );

export type CardSuitSchema = typeof CardSuitSchema.Type;
export const CardSuitSchema = Schema.Literals( Object.values( CARD_SUITS ) );

export type Trick = typeof Trick.Type;
export const Trick = Schema.Struct( {
	leadPlayer: PlayerId,
	suit: Schema.optional( CardSuitSchema ),
	cards: Schema.Record( PlayerId, CardIdSchema ),
	winner: Schema.optional( PlayerId )
} );

export type Deal = typeof Deal.Type;
export const Deal = Schema.Struct( {
	id: Schema.String,
	startingPlayer: PlayerId,
	hands: Schema.Record( PlayerId, Schema.Array( CardIdSchema ) ),
	declarations: Schema.Record( PlayerId, Schema.Number ),
	wins: Schema.Record( PlayerId, Schema.Number ),
	scores: Schema.Record( PlayerId, Schema.Number ),
	tricks: Schema.Array( Trick )
} );

export type PublicDeal = typeof PublicDeal.Type;
export const PublicDeal = Schema.Struct( {
	...Deal.mapFields( Struct.omit( [ "hands" ] ) ).fields
} );


// --- Config / State / Views ------------------------------------------------------

export type CallbreakConfig = typeof CallbreakConfig.Type;
export const CallbreakConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	dealCount: Schema.Number,
	trumpSuit: CardSuitSchema
} );

export type CallbreakState = typeof CallbreakState.Type;
export const CallbreakState = Schema.Struct( {
	deals: Schema.Array( Deal ),
	scores: Schema.Record( PlayerId, Schema.Number ),
	winner: Schema.optional( PlayerId )
} );

export type CallbreakSharedView = typeof CallbreakSharedView.Type;
export const CallbreakSharedView = Schema.Struct( {
	...CallbreakState.mapFields( Struct.omit( [ "deals" ] ) ).fields,
	activeDeal: Schema.optional( PublicDeal ),
	lastCompletedTrick: Schema.optional( Trick )
} );

export type CallbreakPlayerView = typeof CallbreakPlayerView.Type;
export const CallbreakPlayerView = Schema.Struct( {
	playerId: PlayerId,
	hand: Schema.Array( CardIdSchema )
} );

export type CallbreakBotView = typeof CallbreakBotView.Type;
export const CallbreakBotView = Schema.Struct( {
	...CallbreakSharedView.fields,
	...CallbreakPlayerView.fields
} );

export type CallbreakView = typeof CallbreakView.Type;
export const CallbreakView = Schema.Struct( {
	...CallbreakSharedView.fields,
	...CallbreakPlayerView.mapFields( Struct.map( Schema.optionalKey ) ).fields
} );

export type CallbreakSnapshot = typeof CallbreakSnapshot.Type;
export const CallbreakSnapshot = GameSnapshot( CallbreakView, CallbreakConfig );


// --- Move Inputs ------------------------------------------------------

export type DeclareWinsInput = typeof DeclareWinsInput.Type;
export const DeclareWinsInput = Schema.Struct( {
	wins: Schema.Number,
	dealId: Schema.String
} );

export type DeclareWinsMovePayload = typeof DeclareWinsMovePayload.Type;
export const DeclareWinsMovePayload = MovePayload( DeclareWinsInput );

export type PlayCardInput = typeof PlayCardInput.Type;
export const PlayCardInput = Schema.Struct( {
	cardId: CardIdSchema,
	dealId: Schema.String
} );

export type PlayCardMovePayload = typeof PlayCardMovePayload.Type;
export const PlayCardMovePayload = MovePayload( PlayCardInput );

export type CallbreakInitializeInput = typeof CallbreakInitializeInput.Type;
export const CallbreakInitializeInput = InitializeInput( CallbreakConfig );


// --- Domain Events ---------------------------------------------------------

export type ScoreInitializedEvent = typeof ScoreInitializedEvent.Type;
export const ScoreInitializedEvent = Schema.TaggedStruct( "callbreak/ScoreInitialized", {
	playerId: PlayerId
} );

export type DealDealtEvent = typeof DealDealtEvent.Type;
export const DealDealtEvent = Schema.TaggedStruct( "callbreak/DealDealt", { deal: Deal } );

export type WinsDeclaredEvent = typeof WinsDeclaredEvent.Type;
export const WinsDeclaredEvent = Schema.TaggedStruct( "callbreak/WinsDeclared", {
	playerId: PlayerId,
	wins: Schema.Number
} );

export type TrickStartedEvent = typeof TrickStartedEvent.Type;
export const TrickStartedEvent = Schema.TaggedStruct( "callbreak/TrickStarted", {
	leadPlayer: PlayerId
} );

export type CardPlayedEvent = typeof CardPlayedEvent.Type;
export const CardPlayedEvent = Schema.TaggedStruct( "callbreak/CardPlayed", {
	playerId: PlayerId,
	cardId: CardIdSchema
} );

export type TrickWonEvent = typeof TrickWonEvent.Type;
export const TrickWonEvent = Schema.TaggedStruct( "callbreak/TrickWon", { winner: PlayerId } );

export type DealScoredEvent = typeof DealScoredEvent.Type;
export const DealScoredEvent = Schema.TaggedStruct( "callbreak/DealScored", {
	scores: Schema.Record( PlayerId, Schema.Number )
} );

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
