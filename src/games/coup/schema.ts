import * as Schema from "effect/Schema";

import type { HintOf } from "@/swish/schema";
import { BaseGameConfig, InitializeInput, PlayerId, PositiveInt } from "@/swish/schema";


// --- Cards -----------------------------------------------------------------

/** The five characters in a fixed order, for building the deck. */
export const COUP_CHARACTERS = [
	"DUKE",
	"ASSASSIN",
	"CAPTAIN",
	"AMBASSADOR",
	"CONTESSA"
] as const;

/**
 * The five characters, each of which licenses one action and/or one block:
 * - DUKE: takes three coins as Tax, and blocks Foreign Aid
 * - ASSASSIN: pays three coins to take an influence
 * - CAPTAIN: steals two coins, and blocks a Steal
 * - AMBASSADOR: exchanges with the deck, and blocks a Steal
 * - CONTESSA: blocks an Assassination, and does nothing else
 *
 * Nothing in the game checks that you hold the character you are claiming. That
 * is the entire point: a claim is only ever tested if somebody challenges it.
 */
export type CoupCard = typeof CoupCard.Type;
export const CoupCard = Schema.Literals( COUP_CHARACTERS );

/** How many of each character the deck holds. Four, so twenty cards in all. */
export const COUP_CARD_COPIES = 4;

/** Cards dealt to each player, and therefore how many lives they have. */
export const COUP_STARTING_INFLUENCE = 2;

/** Coins each player starts with. */
export const COUP_STARTING_COINS = 2;

/** What a Coup costs. */
export const COUP_COUP_COST = 7;

/** What an Assassination costs, win or lose — the coins are spent on declaring it. */
export const COUP_ASSASSINATE_COST = 3;

/** At this many coins a player may do nothing but Coup. */
export const COUP_FORCED_COUP_COINS = 10;

/** What Income pays. */
export const COUP_INCOME_COINS = 1;

/** What Foreign Aid pays. */
export const COUP_FOREIGN_AID_COINS = 2;

/** What Tax pays. */
export const COUP_TAX_COINS = 3;

/** The most a Steal can take. Less if the target has less. */
export const COUP_STEAL_COINS = 2;

/** How many cards an Exchange draws. */
export const COUP_EXCHANGE_DRAW = 2;

/** The smallest table. */
export const COUP_MIN_PLAYERS = 2;

/** The largest table. */
export const COUP_MAX_PLAYERS = 6;

/** The table size a game is created with when the caller names none. */
export const COUP_DEFAULT_PLAYERS = 4;

/**
 * How long the table has to challenge a claim or block an action.
 *
 * Short, and deliberately so: the window suspends the turn, so every second of it
 * is a second in which the player whose turn it is can do nothing. Long enough to
 * read who claimed what and decide whether to believe them.
 */
export const COUP_CHALLENGE_WINDOW_MILLIS = 15_000;

/**
 * How long a player has to make a decision that has to be made — which influence
 * to give up, which two cards to put back. Longer than a challenge window because
 * there is a real choice in it, and nothing else is waiting on anyone else.
 */
export const COUP_DECISION_WINDOW_MILLIS = 30_000;

/**
 * How long a player may hold their own turn before the seat is handed to the bot
 * policy for the rest of the game.
 */
export const COUP_MOVE_TIMEOUT_MILLIS = 60_000;

/**
 * How long a machine-played seat waits before it acts or answers. It paces the
 * responses to a window as much as the turns: each answer restarts it, so a table
 * of bots works through a challenge window one opinion at a time.
 */
export const COUP_BOT_DELAY_MILLIS = 5_000;


// --- Actions ---------------------------------------------------------------

/**
 * The seven things a turn can be.
 *
 * Three of them are nobody's business: Income, and Coup, which is paid for and
 * cannot be argued with. The other four rest on a claim, and a claim is what an
 * interaction window is opened over.
 */
export type CoupActionName = typeof CoupActionName.Type;
export const CoupActionName = Schema.Literals( [
	"income",
	"foreignAid",
	"coup",
	"tax",
	"assassinate",
	"steal",
	"exchange"
] );

/**
 * The two characters that can stop a Steal.
 */
export type StealBlocker = typeof StealBlocker.Type;
export const StealBlocker = Schema.Literals( [ "CAPTAIN", "AMBASSADOR" ] );

/**
 * The action the table is currently arguing about.
 *
 * This is the *subject* of an interaction window, and it lives here — in the
 * game's own state — rather than on the engine's frame. The frame knows who is
 * being asked and what they may say; this knows what they are saying it about,
 * and only Coup can read it.
 *
 * Set when the action is declared, and cleared when it either happens
 * (`ActionResolved`) or is thrown out (`ActionCancelled`). Coup and Income never
 * declare one: nothing can be said about them, so there is nothing to hold open.
 *
 * - action: What was declared
 * - actor: Who declared it
 * - target: Who it is aimed at, for the three actions that aim
 * - claim: The character the action rests on. Absent for Foreign Aid, which
 * 		claims nothing and is therefore blockable but not challengeable
 * - blocker: Who stood up to stop it, once somebody has
 * - blockClaim: The character their block rests on, which is challengeable in turn
 */
export type CoupPendingAction = typeof CoupPendingAction.Type;
export const CoupPendingAction = Schema.TaggedStruct( "coup/PendingAction", {
	action: CoupActionName,
	actor: PlayerId,
	target: Schema.optional( PlayerId ),
	claim: Schema.optional( CoupCard ),
	blocker: Schema.optional( PlayerId ),
	blockClaim: Schema.optional( CoupCard )
} );


// --- Config / State / View -------------------------------------------------

/**
 * What a table was created with. Extends `BaseGameConfig`.
 * - playerCount: Between two and six. Six is the hard ceiling, inherited from the
 * 		printed game rather than forced by the deck: twenty cards deal two each to
 * 		six players and still leave eight face down
 */
export type CoupConfig = typeof CoupConfig.Type;
export const CoupConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	playerCount: Schema.Int.check(
		Schema.isGreaterThanOrEqualTo( COUP_MIN_PLAYERS ),
		Schema.isLessThanOrEqualTo( COUP_MAX_PLAYERS )
	)
} );

/**
 * The table, unredacted. Never leaves the engine.
 *
 * - deck: The face-down draw pile, top first. Shuffled at `setup` and reshuffled
 * 		whenever a card goes back into it
 * - hands: Each player's face-down cards. The hidden information the whole game
 * 		is played over
 * - lost: Each player's surrendered cards, in the order they gave them up. Known
 * 		to that player alone — the card itself goes back into the deck, so what it
 * 		was is never public and may well be drawn again by somebody else
 * - coins: What each player holds
 * - eliminated: Who is out, in the order they went out. That order is the final
 * 		ranking, read backwards
 * - pending: The action currently being argued about, if any
 * - drawn: The cards an Exchange has put in front of a player but not yet settled.
 * 		Held apart from the hand so a view can redact them on their own, and so a
 * 		player who walks away mid-exchange simply gets them taken back
 */
export type CoupState = typeof CoupState.Type;
export const CoupState = Schema.Struct( {
	deck: Schema.Array( CoupCard ),
	hands: Schema.Record( PlayerId, Schema.Array( CoupCard ) ),
	lost: Schema.Record( PlayerId, Schema.Array( CoupCard ) ),
	coins: Schema.Record( PlayerId, PositiveInt ),
	eliminated: Schema.Array( PlayerId ),
	pending: Schema.optional( CoupPendingAction ),
	drawn: Schema.Record( PlayerId, Schema.Array( CoupCard ) )
} );

/**
 * The table as one audience may see it.
 *
 * One shape for everybody, with the hidden regions modelled explicitly rather
 * than left out: an opponent's hand is `influence`, a count, and never an absent
 * field, so a client renders one view type and never branches on who is watching.
 *
 * - playerId: The seat this view was built for. Absent on the table's
 * - hand: That seat's own cards. Empty for a spectator
 * - drawn: That seat's own exchange draw, while one is in front of them
 * - influence: How many face-down cards each player still holds. How many a seat
 * 		has *lost* is this subtracted from `COUP_STARTING_INFLUENCE`; which cards
 * 		they were is not on the wire at all
 * - lost: The cards this seat has surrendered, in order. Its own only — nobody
 * 		else ever learns what they were
 * - coins: Everybody's coins. Public
 * - eliminated: Who is out, in order
 * - deckSize: How many cards are left face down. Public, and worth knowing
 * - pending: The action being argued about. Public — a claim is made out loud,
 * 		which is what makes challenging it possible
 */
export type CoupView = typeof CoupView.Type;
export const CoupView = Schema.Struct( {
	playerId: Schema.optional( PlayerId ),
	hand: Schema.Array( CoupCard ),
	drawn: Schema.Array( CoupCard ),
	lost: Schema.Array( CoupCard ),
	influence: Schema.Record( PlayerId, PositiveInt ),
	coins: Schema.Record( PlayerId, PositiveInt ),
	eliminated: Schema.Array( PlayerId ),
	deckSize: PositiveInt,
	pending: Schema.optional( CoupPendingAction )
} );


// --- Move Inputs -----------------------------------------------------------

/** No input at all: the move is the whole message. */
export type NoInput = typeof NoInput.Type;
export const NoInput = Schema.Struct( {} );

/**
 * The input for an action aimed at somebody.
 * - target: Who it is aimed at. Must be alive, and must not be the actor
 */
export type TargetInput = typeof TargetInput.Type;
export const TargetInput = Schema.Struct( { target: PlayerId } );

/**
 * The input for blocking a Steal.
 * - claim: Which of the two characters that can stop one is being claimed. Named
 * 		rather than inferred, because it decides what a challenger is challenging
 */
export type BlockStealInput = typeof BlockStealInput.Type;
export const BlockStealInput = Schema.Struct( { claim: StealBlocker } );

/**
 * The input for giving up an influence.
 * - card: Which of your own cards to surrender. Must be one you hold. It goes
 * 		back into the deck without being shown to anybody
 */
export type RevealInput = typeof RevealInput.Type;
export const RevealInput = Schema.Struct( { card: CoupCard } );

/**
 * The input for settling an Exchange.
 * - cards: The cards to keep, out of your hand and the two you drew. Exactly as
 * 		many as you had before, so an Exchange changes what you hold and never how
 * 		much
 */
export type ExchangeReturnInput = typeof ExchangeReturnInput.Type;
export const ExchangeReturnInput = Schema.Struct( { cards: Schema.Array( CoupCard ) } );

/**
 * Every move this game declares, name → input schema.
 *
 * One list, read three times over: the structure builds `schemas.moves` from it,
 * the contract builds the hint endpoint's union of suggestions from it, and the
 * client reads a hint back through CoupHint below. A move added in one of
 * those places and forgotten in another is what having one list prevents.
 */
export const CoupMoveSchemas = {
	income: NoInput,
	foreignAid: NoInput,
	coup: TargetInput,
	tax: NoInput,
	assassinate: TargetInput,
	steal: TargetInput,
	exchange: NoInput,
	challenge: NoInput,
	blockForeignAid: NoInput,
	blockAssassination: NoInput,
	blockSteal: BlockStealInput,
	reveal: RevealInput,
	exchangeReturn: ExchangeReturnInput
};

/** What `GET /api/coup/:gameId/hint` answers with. */
export type CoupHint = HintOf<typeof CoupMoveSchemas>;


/**
 * The input required to create a Coup game.
 * - playerCount: How many seats the table has
 */
export type CoupCreateInput = typeof CoupCreateInput.Type;
export const CoupCreateInput = Schema.Struct( {
	playerCount: Schema.Int.check(
		Schema.isGreaterThanOrEqualTo( COUP_MIN_PLAYERS ),
		Schema.isLessThanOrEqualTo( COUP_MAX_PLAYERS )
	)
} );

/** The input required to initialize a Coup game. */
export type CoupInitializeInput = typeof CoupInitializeInput.Type;
export const CoupInitializeInput = InitializeInput( CoupConfig );


// --- Domain Events ---------------------------------------------------------

/**
 * Emitted once, at `start`, when the table is dealt.
 *
 * Carries the finished deal rather than a seed, so the shuffle is folded and
 * never re-rolled: `setup` and `onStart` are the only places randomness is drawn
 * at all, and what they draw rides here.
 */
export type Dealt = typeof Dealt.Type;
export const Dealt = Schema.TaggedStruct( "coup/ev/Dealt", {
	hands: Schema.Record( PlayerId, Schema.Array( CoupCard ) ),
	deck: Schema.Array( CoupCard )
} );

/**
 * Emitted whenever coins move. A delta rather than a total, so two of them in one
 * commit — a Steal is one of each — compose instead of overwriting.
 */
export type CoinsChanged = typeof CoinsChanged.Type;
export const CoinsChanged = Schema.TaggedStruct( "coup/ev/CoinsChanged", {
	playerId: PlayerId,
	delta: Schema.Int
} );

/**
 * Emitted when a player declares an action the table may object to. Sets
 * `pending`, which is what every window opened over this action reads.
 */
export type ActionDeclared = typeof ActionDeclared.Type;
export const ActionDeclared = Schema.TaggedStruct( "coup/ev/ActionDeclared", {
	action: CoupActionName,
	actor: PlayerId,
	target: Schema.optional( PlayerId ),
	claim: Schema.optional( CoupCard )
} );

/**
 * Emitted when a declared action goes through. Clears `pending`.
 * The coins it moves and the influence it costs are their own events: this one
 * only says the argument is over.
 */
export type ActionResolved = typeof ActionResolved.Type;
export const ActionResolved = Schema.TaggedStruct( "coup/ev/ActionResolved", {} );

/**
 * Emitted when a declared action is thrown out — blocked, or caught as a bluff.
 * Clears `pending`. Coins already spent on declaring it are not returned.
 */
export type ActionCancelled = typeof ActionCancelled.Type;
export const ActionCancelled = Schema.TaggedStruct( "coup/ev/ActionCancelled", {} );

/**
 * Emitted when a player claims a character in order to stop the pending action.
 * Records the block on `pending`, which is what makes it challengeable in turn.
 */
export type BlockDeclared = typeof BlockDeclared.Type;
export const BlockDeclared = Schema.TaggedStruct( "coup/ev/BlockDeclared", {
	blocker: PlayerId,
	claim: CoupCard
} );

/**
 * Emitted when a player loses an influence: the card leaves their hand and goes
 * back into the deck, which is reshuffled around it.
 *
 * Nobody but the player who gave it up ever learns which card it was. What the
 * table sees is that a seat is down to one influence, or out — never what it was
 * holding, and never a card it can cross off. That is what `deck` is carrying:
 * the surrendered card is genuinely back in circulation and can be drawn again,
 * so it cannot be inferred from the count of what is left either.
 *
 * `deck` is the reshuffled pile with the card already in it, for the same reason
 * `CardReplaced` carries one — the fold has to stay pure, and a card merely
 * appended would sit at a known position for the next Exchange to read off.
 */
export type InfluenceLost = typeof InfluenceLost.Type;
export const InfluenceLost = Schema.TaggedStruct( "coup/ev/InfluenceLost", {
	playerId: PlayerId,
	card: CoupCard,
	deck: Schema.Array( CoupCard )
} );

/**
 * Emitted when a player proves a claim: they show the card, put it back, and draw
 * a fresh one — so proving a claim tells the table what you had a moment ago and
 * nothing about what you have now.
 *
 * `deck` is the reshuffled pile with the proven card already in it, and the fold
 * draws the replacement off its top. Carrying the shuffled pile rather than a
 * seed is what keeps the fold pure; drawing inside the fold rather than naming
 * the replacement is what keeps it correct when something else in the same commit
 * has already disturbed the deck.
 */
export type CardReplaced = typeof CardReplaced.Type;
export const CardReplaced = Schema.TaggedStruct( "coup/ev/CardReplaced", {
	playerId: PlayerId,
	card: CoupCard,
	deck: Schema.Array( CoupCard )
} );

/**
 * Emitted when an Exchange puts cards in front of a player. The fold takes them
 * off the top of the deck, so `count` is all this needs to carry — and all it
 * *may* carry, since the deck may have been reshuffled earlier in the same commit
 * by a challenge that was settled first.
 */
export type ExchangeDrawn = typeof ExchangeDrawn.Type;
export const ExchangeDrawn = Schema.TaggedStruct( "coup/ev/ExchangeDrawn", {
	playerId: PlayerId,
	count: PositiveInt
} );

/**
 * Emitted when an Exchange is settled: the player keeps `hand` and everything
 * else goes back into the reshuffled `deck`.
 */
export type ExchangeReturned = typeof ExchangeReturned.Type;
export const ExchangeReturned = Schema.TaggedStruct( "coup/ev/ExchangeReturned", {
	playerId: PlayerId,
	hand: Schema.Array( CoupCard ),
	deck: Schema.Array( CoupCard )
} );

/**
 * Emitted when a player turns over their last influence. Records the order they
 * went out in, which read backwards is the final ranking.
 */
export type PlayerEliminated = typeof PlayerEliminated.Type;
export const PlayerEliminated = Schema.TaggedStruct( "coup/ev/PlayerEliminated", {
	playerId: PlayerId
} );

/** Union of every event a Coup game emits. */
export type CoupEvent = typeof CoupEvent.Type;
export const CoupEvent = Schema.Union( [
	Dealt,
	CoinsChanged,
	ActionDeclared,
	ActionResolved,
	ActionCancelled,
	BlockDeclared,
	InfluenceLost,
	CardReplaced,
	ExchangeDrawn,
	ExchangeReturned,
	PlayerEliminated
] );
