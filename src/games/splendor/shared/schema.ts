import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import {
	BaseGameConfig,
	InitializeInput,
	PlayerId,
	PositiveInt,
	SeatView
} from "@/swish/shared/schema.ts";

// --- Primitives ---------------------------------------------------------------

export type Gem = typeof Gem.Type;
export const Gem = Schema.Literals( [ "diamond", "sapphire", "emerald", "ruby", "onyx", "gold" ] );

export type GemNoGold = typeof GemNoGold.Type;
export const GemNoGold = Schema.Literals( [ "diamond", "sapphire", "emerald", "ruby", "onyx" ] );

export type CardLevel = typeof CardLevel.Type;
export const CardLevel = Schema.Literals( [ 1, 2, 3 ] );

export type Tokens = typeof Tokens.Type;
export const Tokens = Schema.Struct( {
	diamond: PositiveInt,
	sapphire: PositiveInt,
	emerald: PositiveInt,
	ruby: PositiveInt,
	onyx: PositiveInt,
	gold: PositiveInt
} );

export type Cost = typeof Cost.Type;
export const Cost = Schema.Struct( {
	diamond: PositiveInt,
	sapphire: PositiveInt,
	emerald: PositiveInt,
	ruby: PositiveInt,
	onyx: PositiveInt
} );

export type Card = typeof Card.Type;
export const Card = Schema.Struct( {
	id: Schema.String,
	level: CardLevel,
	points: PositiveInt,
	cost: Cost,
	bonus: GemNoGold
} );

export type Noble = typeof Noble.Type;
export const Noble = Schema.Struct( {
	id: Schema.String,
	points: PositiveInt,
	cost: Cost
} );

/**
 * Everything one seat owns.
 * - tokens: The gems in front of them, gold included
 * - cards: The development cards they bought — their permanent discounts
 * - nobles: The nobles that came to visit
 * - reserved: The cards they hold unbought, at most {@link SPLENDOR_MAX_RESERVED}.
 * 		Taken face up off the board, so the whole table has seen them
 * - points: Prestige, from cards and nobles alike
 */
export type PlayerData = typeof PlayerData.Type;
export const PlayerData = Schema.Struct( {
	tokens: Tokens,
	cards: Schema.Array( Card ),
	nobles: Schema.Array( Noble ),
	reserved: Schema.Array( Card ),
	points: PositiveInt
} );

export type CardsByLevel = typeof CardsByLevel.Type;
export const CardsByLevel = Schema.Struct( {
	1: Schema.Array( Card ),
	2: Schema.Array( Card ),
	3: Schema.Array( Card )
} );

/** How many cards each deck still holds. The view's stand-in for the decks. */
export type DeckCounts = typeof DeckCounts.Type;
export const DeckCounts = Schema.Struct( {
	1: PositiveInt,
	2: PositiveInt,
	3: PositiveInt
} );


// --- Constants ---------------------------------------------------------------

export const SPLENDOR_PLAYER_COUNTS = [ 2, 3, 4 ] as const;

/**
 * The targets a table may be played to: prestige a seat has to reach for the
 * round it happens in to be the last one.
 *
 * A shorter game is not a different game — nothing else reads the target, so ten
 * simply ends a few rounds earlier than the printed fifteen and twenty a few
 * rounds later. Fixed to three choices rather than any number, so the target is
 * something a lobby offers rather than something a caller invents.
 */
export const SPLENDOR_WINNING_POINTS = [ 10, 15, 20 ] as const;

/** The printed target, and what a table plays to when nobody says otherwise. */
export const SPLENDOR_DEFAULT_WINNING_POINTS = 15;

/**
 * How many of each gem the bank holds, by seat count. Straight out of the
 * rulebook: a duel plays with fewer gems in circulation than a full table, which
 * is what makes the "two of a kind needs four in the pile" rule bite.
 */
export const SPLENDOR_TOKEN_SUPPLY: Record<typeof SPLENDOR_PLAYER_COUNTS[number], number> = {
	2: 4,
	3: 5,
	4: 7
};

/** Gold is fixed at five however many are playing. */
export const SPLENDOR_GOLD_SUPPLY = 5;

/** How many cards of each level lie face up. */
export const SPLENDOR_OPEN_CARDS = 4;

/** The most tokens a seat may end its turn holding. */
export const SPLENDOR_MAX_TOKENS = 10;

/** The most cards a seat may hold unbought. */
export const SPLENDOR_MAX_RESERVED = 3;

/**
 * How long a seat may hold its turn. An expired clock hands the seat to
 * `botMove` and leaves it there until its player takes it back, so a player who
 * walks away is played for rather than stalling a table of four.
 */
export const SPLENDOR_MOVE_TIMEOUT_MILLIS = 120_000;

/**
 * The reaction window a purchase opens when more than one noble would come to
 * visit. Named here rather than inline because both the engine's `interactions`
 * key and the client's frame check have to agree on it.
 */
export const SPLENDOR_NOBLE_VISIT = "noble-visit";

/**
 * How long the buyer has to choose between nobles. Short: it is a one-tap
 * decision on a frame that holds the whole table up, and the seat is handed to
 * the policy rather than skipped when it expires.
 */
export const SPLENDOR_NOBLE_TIMEOUT_MILLIS = 30_000;


// --- Config / State / Views ------------------------------------------------------

/**
 * What a table was created with. Extends `BaseGameConfig`
 * - playerCount: How many seats, two to four — the bank's size is read off it
 * - winningPoints: The prestige that makes the current round the last one, one
 * 		of {@link SPLENDOR_WINNING_POINTS}
 */
export type SplendorConfig = typeof SplendorConfig.Type;
export const SplendorConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	playerCount: Schema.Literals( SPLENDOR_PLAYER_COUNTS ),
	winningPoints: Schema.Literals( SPLENDOR_WINNING_POINTS )
} );

/**
 * The table and everyone at it.
 * - tokens: The bank
 * - cards: The face-up cards, four per level
 * - nobles: The nobles still unclaimed
 * - decks: What is left to draw, in order. The one private region: a deck's
 * 		*order* is the whole of this game's hidden information, so it never reaches
 * 		a view — only its length does
 * - playerData: Every seat's holdings, all of it public
 *
 * There is no `winner` here. How a game came out is `Standings`, which the
 * engine stamps onto the record from `resolveResults` and every `GameView`
 * carries — a second copy folded into the state could only ever disagree with it.
 */
export type SplendorState = typeof SplendorState.Type;
export const SplendorState = Schema.Struct( {
	tokens: Tokens,
	cards: CardsByLevel,
	nobles: Schema.Array( Noble ),
	decks: CardsByLevel,
	playerData: Schema.Record( PlayerId, PlayerData )
} );

/**
 * One shape for every audience. Splendor is a game of perfect information but
 * for one thing — the order of the three decks — so the only redaction is that
 * the decks become their lengths. Everything else on the table is public,
 * reserved cards included: they were face up when they were taken.
 *
 * - deckCounts: What is left to draw per level, so a client can show a row
 * 		running out
 * - playerId: The seat this view was built for, absent on the table's. The only
 * 		thing that varies between one audience's view and another's
 */
export type SplendorView = typeof SplendorView.Type;
export const SplendorView = Schema.Struct( {
	...SplendorState.mapFields( Struct.omit( [ "decks" ] ) ).fields,
	deckCounts: DeckCounts,
	playerId: Schema.optional( PlayerId )
} );

/** The table as one of its seats sees it — {@link SeatView} over the view above. */
export type SplendorSeatView = typeof SplendorSeatView.Type;
export const SplendorSeatView = SeatView( SplendorView );


// --- Move Inputs ------------------------------------------------------

export type PartialTokens = typeof PartialTokens.Type;
export const PartialTokens = Tokens.mapFields( Struct.map( Schema.optional ) );

/**
 * The input required to take gems.
 * - tokens: What is being taken — three different gems, or two of one
 * - returned: What is being put back, when the take would carry the seat over
 * 		{@link SPLENDOR_MAX_TOKENS}. Same move rather than a follow-up, so a seat is
 * 		never left mid-turn holding eleven
 */
export type PickTokensInput = typeof PickTokensInput.Type;
export const PickTokensInput = Schema.Struct( {
	tokens: PartialTokens,
	returned: Schema.optional( PartialTokens )
} );

/**
 * The input required to reserve a face-up card.
 * - cardId: The card being taken off the board
 * - withGold: Whether to take the gold that comes with a reservation. Optional
 * 		because a seat at the token limit may prefer not to discard for it
 * - returnedToken: What to put back when the gold carries the seat over
 * 		{@link SPLENDOR_MAX_TOKENS}
 */
export type ReserveCardInput = typeof ReserveCardInput.Type;
export const ReserveCardInput = Schema.Struct( {
	cardId: Schema.String,
	withGold: Schema.Boolean,
	returnedToken: Schema.optional( Gem )
} );

/**
 * The input required to buy a card.
 * - cardId: The card, face up on the board or held in reserve
 * - payment: Exactly what it costs after discounts, gold covering the shortfall.
 * 		Spelled out by the caller rather than worked out by the server, because a
 * 		seat holding gold and gems both has a real choice about which to spend
 */
export type PurchaseCardInput = typeof PurchaseCardInput.Type;
export const PurchaseCardInput = Schema.Struct( {
	cardId: Schema.String,
	payment: PartialTokens
} );

/**
 * The input required to give up a turn: nothing. Which seat is passing is the
 * caller's own, and *why* is not a choice — the move is only legal when the
 * rules leave the seat nothing else to do.
 */
export type PassInput = typeof PassInput.Type;
export const PassInput = Schema.Struct( {} );

/**
 * The input required to settle a {@link SPLENDOR_NOBLE_VISIT} frame: which of the
 * nobles now willing to visit the buyer actually does. Only ever played as a
 * response, and only by the seat whose purchase opened the frame.
 */
export type ClaimNobleInput = typeof ClaimNobleInput.Type;
export const ClaimNobleInput = Schema.Struct( { nobleId: Schema.String } );

/**
 * The input required to create a game: how many seats, and how long a game.
 * Both are narrowed to the values a table can actually be played at, so a
 * request for anything else is refused at the decode boundary rather than
 * reaching `SplendorConfig.make` and throwing a defect.
 *
 * - playerCount: How many seats to lay out
 * - winningPoints: What to play to. Absent means the printed
 * 		{@link SPLENDOR_DEFAULT_WINNING_POINTS}
 *
 * The move clock and whether the table starts itself stay the server's to fix.
 */
export type SplendorCreateInput = typeof SplendorCreateInput.Type;
export const SplendorCreateInput = Schema.Struct( {
	playerCount: Schema.Literals( SPLENDOR_PLAYER_COUNTS ),
	winningPoints: Schema.optional( Schema.Literals( SPLENDOR_WINNING_POINTS ) )
} );

export type SplendorInitializeInput = typeof SplendorInitializeInput.Type;
export const SplendorInitializeInput = InitializeInput( SplendorConfig );

// --- Domain Events -----------------------------------------------

export type PlayerDataInitializedEvent = typeof PlayerDataInitializedEvent.Type;
export const PlayerDataInitializedEvent = Schema.TaggedStruct(
	"splendor/ev/PlayerDataInitialized",
	{ playerId: PlayerId }
);

/**
 * Emitted at `start`, once the seats are known: the bank is sized to them, the
 * nobles are drawn and the first four cards of each level are turned up.
 */
export type GameDealtEvent = typeof GameDealtEvent.Type;
export const GameDealtEvent = Schema.TaggedStruct( "splendor/ev/GameDealt", {
	tokens: Tokens,
	nobles: Schema.Array( Noble ),
	cards: CardsByLevel,
	decks: CardsByLevel
} );

export type TokensPickedEvent = typeof TokensPickedEvent.Type;
export const TokensPickedEvent = Schema.TaggedStruct( "splendor/ev/TokensPicked", {
	playerId: PlayerId,
	tokens: PartialTokens,
	returned: Schema.optional( PartialTokens )
} );

/**
 * Emitted when a card is put in reserve.
 * - replacement: The card turned up in its place, `null` once the deck is spent
 */
export type CardReservedEvent = typeof CardReservedEvent.Type;
export const CardReservedEvent = Schema.TaggedStruct( "splendor/ev/CardReserved", {
	playerId: PlayerId,
	card: Card,
	replacement: Schema.NullOr( Card ),
	withGold: Schema.Boolean,
	returnedToken: Schema.optional( Gem )
} );

/**
 * Emitted when a card is bought. It says nothing about nobles: a visit is its
 * own event, since the buyer may have a choice to make first and the purchase
 * has to be folded before that choice can even be offered.
 */
export type CardPurchasedEvent = typeof CardPurchasedEvent.Type;
export const CardPurchasedEvent = Schema.TaggedStruct( "splendor/ev/CardPurchased", {
	playerId: PlayerId,
	card: Card,
	fromReserved: Schema.Boolean,
	replacement: Schema.NullOr( Card ),
	payment: PartialTokens
} );

/**
 * Emitted when a noble comes to visit — straight after the purchase when only
 * one qualifies, or out of the frame's resolution when the buyer had to choose.
 */
export type NobleVisitedEvent = typeof NobleVisitedEvent.Type;
export const NobleVisitedEvent = Schema.TaggedStruct( "splendor/ev/NobleVisited", {
	playerId: PlayerId,
	noble: Noble
} );

export type SplendorEvent = typeof SplendorEvent.Type;
export const SplendorEvent = Schema.Union( [
	PlayerDataInitializedEvent,
	GameDealtEvent,
	TokensPickedEvent,
	CardReservedEvent,
	CardPurchasedEvent,
	NobleVisitedEvent
] );
