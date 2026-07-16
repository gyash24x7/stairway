import { BaseGameConfig, type BaseGameData, GameSnapshot, PlayerId } from "@s2h/swish/schema";
import * as Schema from "effect/Schema";

// --- Schemas ---------------------------------------------------------------

export type Gem = typeof Gem.Type;
export const Gem = Schema.Literals( [ "diamond", "sapphire", "emerald", "ruby", "onyx", "gold" ] );

export type GemNoGold = typeof GemNoGold.Type;
export const GemNoGold = Schema.Literals( [ "diamond", "sapphire", "emerald", "ruby", "onyx" ] );

export type CardLevel = typeof CardLevel.Type;
export const CardLevel = Schema.Literals( [ 1, 2, 3 ] );

/** Full token pool: all six gem counts present. */
export type Tokens = typeof Tokens.Type;
export const Tokens = Schema.Struct( {
	diamond: Schema.Number,
	sapphire: Schema.Number,
	emerald: Schema.Number,
	ruby: Schema.Number,
	onyx: Schema.Number,
	gold: Schema.Number
} );

/** A development card's cost: the five non-gold gems. */
export type Cost = typeof Cost.Type;
export const Cost = Schema.Struct( {
	diamond: Schema.Number,
	sapphire: Schema.Number,
	emerald: Schema.Number,
	ruby: Schema.Number,
	onyx: Schema.Number
} );

export type Card = typeof Card.Type;
export const Card = Schema.Struct( {
	id: Schema.String,
	level: CardLevel,
	points: Schema.Number,
	cost: Cost,
	bonus: GemNoGold
} );

export type Noble = typeof Noble.Type;
export const Noble = Schema.Struct( {
	id: Schema.String,
	points: Schema.Number,
	cost: Cost
} );

export type PlayerData = typeof PlayerData.Type;
export const PlayerData = Schema.Struct( {
	tokens: Tokens,
	cards: Schema.Array( Card ),
	nobles: Schema.Array( Noble ),
	reserved: Schema.Array( Card ),
	points: Schema.Number
} );

export type CardsByLevel = typeof CardsByLevel.Type;
export const CardsByLevel = Schema.Struct( {
	1: Schema.Array( Card ),
	2: Schema.Array( Card ),
	3: Schema.Array( Card )
} );

export type SplendorConfig = typeof SplendorConfig.Type;
export const SplendorConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	winningPoints: Schema.Number
} );

export type SplendorState = typeof SplendorState.Type;
export const SplendorState = Schema.Struct( {
	tokens: Tokens,
	cards: CardsByLevel,
	nobles: Schema.Array( Noble ),
	decks: CardsByLevel,
	playerData: Schema.Record( PlayerId, PlayerData ),
	winner: Schema.optional( PlayerId )
} );

/** Shared view hides the face-down decks. */
export type SplendorSharedView = typeof SplendorSharedView.Type;
export const SplendorSharedView = Schema.Struct( {
	tokens: Tokens,
	cards: CardsByLevel,
	nobles: Schema.Array( Noble ),
	playerData: Schema.Record( PlayerId, PlayerData ),
	winner: Schema.optional( PlayerId )
} );

export type SplendorPlayerView = typeof SplendorPlayerView.Type;
export const SplendorPlayerView = Schema.Struct( { playerId: PlayerId } );

// The single audience view: the shared board (decks hidden), plus `playerId`
// for a Player audience (absent for the Table / spectator audience).
export type SplendorView = typeof SplendorView.Type;
export const SplendorView = Schema.Struct( {
	...SplendorSharedView.fields,
	playerId: Schema.optional( PlayerId )
} );

export type SplendorSnapshot = typeof SplendorSnapshot.Type;
export const SplendorSnapshot = GameSnapshot( SplendorView, SplendorConfig );

// A `Partial<Tokens>` on the wire: only the picked/paid/returned gems present.
export type PartialTokens = typeof PartialTokens.Type;
export const PartialTokens = Schema.Record( Gem, Schema.Number );

export type PickTokensInput = typeof PickTokensInput.Type;
export const PickTokensInput = Schema.Struct( {
	tokens: PartialTokens,
	returned: Schema.optional( PartialTokens )
} );

export type ReserveCardInput = typeof ReserveCardInput.Type;
export const ReserveCardInput = Schema.Struct( {
	cardId: Schema.String,
	withGold: Schema.Boolean,
	returnedToken: Schema.optional( Gem )
} );

export type PurchaseCardInput = typeof PurchaseCardInput.Type;
export const PurchaseCardInput = Schema.Struct( {
	cardId: Schema.String,
	payment: PartialTokens
} );


// --- Domain events -----------------------------------------------

export type PlayerDataInitializedEvent = typeof PlayerDataInitializedEvent.Type;
export const PlayerDataInitializedEvent = Schema.TaggedStruct(
	"splendor/evt/PlayerDataInitialized",
	{ playerId: PlayerId }
);

// The nondeterministic deal captured at start: token pool, dealt nobles, the
// four open cards per level, and the remaining decks after dealing.
export type GameDealtEvent = typeof GameDealtEvent.Type;
export const GameDealtEvent = Schema.TaggedStruct( "splendor/evt/GameDealt", {
	tokens: Tokens,
	nobles: Schema.Array( Noble ),
	cards: CardsByLevel,
	decks: CardsByLevel
} );

export type TokensPickedEvent = typeof TokensPickedEvent.Type;
export const TokensPickedEvent = Schema.TaggedStruct( "splendor/evt/TokensPicked", {
	playerId: PlayerId,
	tokens: PartialTokens,
	returned: Schema.optional( PartialTokens )
} );

// `replacement` is the concrete card drawn from the deck to refill the open
// slot (or null when the deck is exhausted) — captured so replay is exact.
export type CardReservedEvent = typeof CardReservedEvent.Type;
export const CardReservedEvent = Schema.TaggedStruct( "splendor/evt/CardReserved", {
	playerId: PlayerId,
	card: Card,
	replacement: Schema.NullOr( Card ),
	withGold: Schema.Boolean,
	returnedToken: Schema.optional( Gem )
} );

export type CardPurchasedEvent = typeof CardPurchasedEvent.Type;
export const CardPurchasedEvent = Schema.TaggedStruct( "splendor/evt/CardPurchased", {
	playerId: PlayerId,
	card: Card,
	fromReserved: Schema.Boolean,
	replacement: Schema.NullOr( Card ),
	payment: PartialTokens,
	noble: Schema.NullOr( Noble )
} );

export type WinnerDecidedEvent = typeof WinnerDecidedEvent.Type;
export const WinnerDecidedEvent = Schema.TaggedStruct(
	"splendor/evt/WinnerDecided",
	{ winner: PlayerId }
);

export type SplendorEvent = typeof SplendorEvent.Type;
export const SplendorEvent = Schema.Union( [
	PlayerDataInitializedEvent,
	GameDealtEvent,
	TokensPickedEvent,
	CardReservedEvent,
	CardPurchasedEvent,
	WinnerDecidedEvent
] );

export type SplendorData = BaseGameData & {
	config: typeof SplendorConfig.Type;
	shared: typeof SplendorSharedView.Type;
	player: typeof SplendorPlayerView.Type;
};
