import {
	BaseGameConfig,
	GameSnapshot,
	InitializeInput,
	MovePayload,
	PlayerId
} from "@s2h/swish/schema";
import * as Schema from "effect/Schema";

// --- Primitives ---------------------------------------------------------------

export type Gem = typeof Gem.Type;
export const Gem = Schema.Literals( [ "diamond", "sapphire", "emerald", "ruby", "onyx", "gold" ] );

export type GemNoGold = typeof GemNoGold.Type;
export const GemNoGold = Schema.Literals( [ "diamond", "sapphire", "emerald", "ruby", "onyx" ] );

export type CardLevel = typeof CardLevel.Type;
export const CardLevel = Schema.Literals( [ 1, 2, 3 ] );

export type Tokens = typeof Tokens.Type;
export const Tokens = Schema.Struct( {
	diamond: Schema.Number,
	sapphire: Schema.Number,
	emerald: Schema.Number,
	ruby: Schema.Number,
	onyx: Schema.Number,
	gold: Schema.Number
} );

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


// --- Config / State / Views ------------------------------------------------------

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

export type SplendorView = typeof SplendorView.Type;
export const SplendorView = Schema.Struct( {
	...SplendorState.fields,
	playerId: Schema.optional( PlayerId )
} );

export type SplendorSnapshot = typeof SplendorSnapshot.Type;
export const SplendorSnapshot = GameSnapshot( SplendorView, SplendorConfig );


// --- Move Inputs ------------------------------------------------------

export type PartialTokens = typeof PartialTokens.Type;
export const PartialTokens = Schema.Record( Gem, Schema.Number );

export type PickTokensInput = typeof PickTokensInput.Type;
export const PickTokensInput = Schema.Struct( {
	tokens: PartialTokens,
	returned: Schema.optional( PartialTokens )
} );

export type PickTokensMovePayload = typeof PickTokensMovePayload.Type;
export const PickTokensMovePayload = MovePayload( PickTokensInput );

export type ReserveCardInput = typeof ReserveCardInput.Type;
export const ReserveCardInput = Schema.Struct( {
	cardId: Schema.String,
	withGold: Schema.Boolean,
	returnedToken: Schema.optional( Gem )
} );

export type ReserveCardMovePayload = typeof ReserveCardMovePayload.Type;
export const ReserveCardMovePayload = MovePayload( ReserveCardInput );

export type PurchaseCardInput = typeof PurchaseCardInput.Type;
export const PurchaseCardInput = Schema.Struct( {
	cardId: Schema.String,
	payment: PartialTokens
} );

export type PurchaseCardMovePayload = typeof PurchaseCardMovePayload.Type;
export const PurchaseCardMovePayload = MovePayload( PurchaseCardInput );

export type SplendorInitializeInput = typeof SplendorInitializeInput.Type;
export const SplendorInitializeInput = InitializeInput( SplendorConfig );

// --- Domain Events -----------------------------------------------

export type PlayerDataInitializedEvent = typeof PlayerDataInitializedEvent.Type;
export const PlayerDataInitializedEvent = Schema.TaggedStruct(
	"splendor/evt/PlayerDataInitialized",
	{ playerId: PlayerId }
);

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
