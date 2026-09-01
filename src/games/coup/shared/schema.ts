import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import {
	BaseGameConfig,
	InitializeInput,
	PlayerId,
	PositiveInt,
	SeatView
} from "@/swish/shared/schema.ts";


// --- Enumerations ----------------------------------------------------------

/**
 * The five characters, three copies of each. A character is never held by name
 * alone anywhere public: what a seat holds is the game's whole secret, and only
 * a card that has been *lost* is named where everyone can read it.
 */
export type CharacterCard = typeof CharacterCard.Type;
export const CharacterCard = Schema.Literals( [
	"duke",
	"assassin",
	"captain",
	"ambassador",
	"contessa"
] );

/**
 * What a seat may do on its turn.
 *
 * Three of these claim nothing — `income`, `foreignAid` and `coup` are available
 * to anyone — and the other four assert a character the seat may or may not
 * hold. Which is which is {@link claimFor}'s answer rather than a flag here, so
 * the table and the rules cannot drift apart.
 */
export type ActionKind = typeof ActionKind.Type;
export const ActionKind = Schema.Literals( [
	"income",
	"foreignAid",
	"coup",
	"tax",
	"assassinate",
	"steal",
	"exchange"
] );

/**
 * What a seat has to do once an influence is taken off it, and what happens to
 * the action that was in flight when it did.
 *
 * The loss and the action are separate steps because the loss is a *choice* —
 * which of two cards to turn over — and the engine has to wait on it. The
 * continuation therefore has to be carried across that wait, and this is what
 * carries it:
 * - continue-action: The action survives and goes on to its block window, if it
 * 		has one. A challenge that failed leaves the action standing
 * - apply-action: The action lands now, with no block window left to run. This
 * 		is a block that was itself a bluff: the block is gone, so nothing is left
 * 		between the action and its target
 * - abort-action: The action does not happen. Either its own claim was a bluff,
 * 		or a genuine block stopped it
 * - none: Nothing was in flight. A Coup is nobody's claim and cannot be stopped
 */
export type LossOutcome = typeof LossOutcome.Type;
export const LossOutcome = Schema.Literals( [
	"continue-action",
	"apply-action",
	"abort-action",
	"none"
] );


// --- Constants -------------------------------------------------------------

/** How many seats a table may have. The two-player duel is deliberately absent. */
export const COUP_PLAYER_COUNTS = [ 3, 4, 5, 6 ] as const;

/** Copies of each character in the deck, so fifteen cards in all. */
export const COUP_COPIES_PER_CHARACTER = 3;

/** What a seat is dealt: two face-down cards and two coins. */
export const COUP_STARTING_INFLUENCE = 2;
export const COUP_STARTING_COINS = 2;

/** What the two removal actions cost the seat taking them. */
export const COUP_COUP_COST = 7;
export const COUP_ASSASSINATE_COST = 3;

/** What `steal` takes, when the target has it to take. */
export const COUP_STEAL_AMOUNT = 2;

/** What `income` and `foreignAid` are worth. */
export const COUP_INCOME_AMOUNT = 1;
export const COUP_FOREIGN_AID_AMOUNT = 2;

/** What `tax` is worth. */
export const COUP_TAX_AMOUNT = 3;

/** How many cards `exchange` draws. */
export const COUP_EXCHANGE_DRAW = 2;

/**
 * The pile a seat may not sit on. At this many coins Coup stops being one option
 * among several and becomes the only legal action, which is what stops a table
 * stalling behind someone who would rather hoard than commit.
 */
export const COUP_MANDATORY_COUP_COINS = 10;

/**
 * How long a seat may hold its own turn. Generous, because choosing an action
 * and a target is the one point in a turn worth thinking about.
 */
export const COUP_MOVE_TIMEOUT_MILLIS = 60_000;

/**
 * How long a challenge or block window stays open. Short on purpose: every
 * living seat is waiting on it, and the honest answer to most claims is nothing
 * at all. Silence is a pass.
 */
export const COUP_REACTION_TIMEOUT_MILLIS = 15_000;

/**
 * How long one seat's private choice stays open — which card to give up, which
 * two to keep. Longer than a reaction window, since only the table waits and the
 * decision is the seat's whole game.
 */
export const COUP_CHOICE_TIMEOUT_MILLIS = 30_000;


// --- Interaction kinds -----------------------------------------------------

/**
 * The reaction windows a turn can open, named here rather than inline because
 * the engine's `interactions` map, the moves that respond into them and the
 * client that renders them all have to agree on the string.
 */
export const COUP_CHALLENGE_ACTION = "coup/ix/challenge-action";
export const COUP_BLOCK_ACTION = "coup/ix/block-action";
export const COUP_CHALLENGE_BLOCK = "coup/ix/challenge-block";
export const COUP_LOSE_INFLUENCE = "coup/ix/lose-influence";
export const COUP_EXCHANGE = "coup/ix/exchange";


// --- Domain Primitives -----------------------------------------------------

/**
 * What one seat holds.
 * - coins: The seat's treasury, public
 * - influence: The cards still in front of it. The game's hidden information —
 * 		this never reaches a view but its owner's
 *
 * There is no pile of lost cards. A card given up is named as it goes and then
 * returns to the deck, so the only lasting record of it is how much smaller the
 * seat's hand became. That keeps every character live for the whole game: no
 * claim is ever provably a bluff from the table alone, and a seat cannot be read
 * off what it has already lost.
 */
export type CoupPlayerData = typeof CoupPlayerData.Type;
export const CoupPlayerData = Schema.Struct( {
	coins: PositiveInt,
	influence: Schema.Array( CharacterCard )
} );

/**
 * A seat as everyone else sees it: the coins, with the cards reduced to how many
 * there are.
 */
export type CoupPublicPlayerData = typeof CoupPublicPlayerData.Type;
export const CoupPublicPlayerData = Schema.Struct( {
	...CoupPlayerData.mapFields( Struct.omit( [ "influence" ] ) ).fields,
	influenceCount: PositiveInt
} );

/**
 * Who blocked an action, and as what.
 */
export type BlockClaim = typeof BlockClaim.Type;
export const BlockClaim = Schema.Struct( {
	by: PlayerId,
	card: CharacterCard
} );

/**
 * The action currently being resolved, and everything the windows above it need
 * to know to finish it.
 *
 * This lives in the state rather than on the interaction frame for two reasons.
 * A frame opened from a resolution *replaces* its parent on the stack, so
 * anything carried in a payload would be lost at the first nesting — and the
 * chain here nests four deep. And `InteractionFrame.payload` rides `GameContext`
 * into every audience's view, so it is public: fine for the claim, which is
 * announced, and quite wrong for anything else.
 *
 * - action: What was declared
 * - actor: Who declared it
 * - target: Who it is aimed at, for the three actions that name somebody
 * - claim: The character being asserted, absent for the three that assert none
 * - block: The block standing against it, once somebody has played one
 */
export type PendingAction = typeof PendingAction.Type;
export const PendingAction = Schema.Struct( {
	action: ActionKind,
	actor: PlayerId,
	target: Schema.optional( PlayerId ),
	claim: Schema.optional( CharacterCard ),
	block: Schema.optional( BlockClaim )
} );

/**
 * One line of the table's history, in the order it happened.
 *
 * Kept as structured entries rather than rendered strings so the couch screen
 * can style a successful challenge differently from a failed one, and so the
 * wording lives with the client rather than in the state.
 */
export type LogEntry = typeof LogEntry.Type;
export const LogEntry = Schema.Struct( {
	turn: PositiveInt,
	actor: PlayerId,
	action: Schema.optional( ActionKind ),
	target: Schema.optional( PlayerId ),
	card: Schema.optional( CharacterCard ),
	note: Schema.NonEmptyString
} );


// --- Config / State / Views ------------------------------------------------

/**
 * What a table was created with. Extends `BaseGameConfig`
 * - playerCount: How many seats, three to six
 */
export type CoupConfig = typeof CoupConfig.Type;
export const CoupConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	playerCount: Schema.Literals( COUP_PLAYER_COUNTS )
} );

/**
 * The table and everyone at it.
 *
 * - deck: What is left to draw, in order. Private in both senses — which cards
 * 		remain *and* in what order, since a card returned after a proven claim goes
 * 		back into it
 * - playerData: Every seat's coins, hand and dead cards
 * - pending: The action being resolved, absent between turns
 * - exchangeDraw: The cards an Ambassador has drawn but not yet chosen from.
 * 		Private to the seat exchanging, and the reason this is state rather than a
 * 		frame payload
 * - eliminationOrder: Who went out, earliest first. The final ranking is read off
 * 		this, since a game that ends with one seat standing has no score to sort by
 * - log: What has happened, oldest first
 *
 * How the game came out is not here. That is `Standings`, which `resolveResults`
 * builds and the engine stamps onto the record.
 */
export type CoupState = typeof CoupState.Type;
export const CoupState = Schema.Struct( {
	deck: Schema.Array( CharacterCard ),
	playerData: Schema.Record( PlayerId, CoupPlayerData ),
	pending: Schema.optional( PendingAction ),
	exchangeDraw: Schema.optional( Schema.Array( CharacterCard ) ),
	eliminationOrder: Schema.Array( PlayerId ),
	log: Schema.Array( LogEntry )
} );

/**
 * One shape for every audience, with the hidden regions modelled explicitly
 * rather than left out: a client renders one view type instead of branching on
 * who is watching.
 *
 * Three things are redacted. Every seat's `influence` becomes an
 * `influenceCount`, so an opponent's hand is a number rather than a list. The
 * deck becomes its length. And the Ambassador's draw reaches only the seat doing
 * the exchanging.
 *
 * - playerData: Every seat, with living cards counted rather than named
 * - deckCount: How much is left to draw
 * - influence: This audience's own cards. Empty for the table
 * - exchangeDraw: What this audience drew, when it is mid-exchange
 * - playerId: The seat this view was built for, absent on the table's
 */
export type CoupView = typeof CoupView.Type;
export const CoupView = Schema.Struct( {
	...CoupState.mapFields( Struct.omit( [ "deck", "playerData", "exchangeDraw" ] ) ).fields,
	playerData: Schema.Record( PlayerId, CoupPublicPlayerData ),
	deckCount: PositiveInt,
	influence: Schema.Array( CharacterCard ),
	exchangeDraw: Schema.optional( Schema.Array( CharacterCard ) ),
	playerId: Schema.optional( PlayerId )
} );

/** The table as one of its seats sees it — {@link SeatView} over the view above. */
export type CoupSeatView = typeof CoupSeatView.Type;
export const CoupSeatView = SeatView( CoupView );


// --- Move Inputs -----------------------------------------------------------

/**
 * The input required to take a turn.
 *
 * One move rather than seven, because all seven run the same pipeline — declare,
 * survive the challenge window, survive the block window, land — and splitting
 * them would copy that plumbing across seven endpoints to no end.
 *
 * - action: What is being taken
 * - target: Who it is aimed at. Required by `coup`, `assassinate` and `steal`,
 * 		and refused by the rest; that is `validate`'s business rather than the
 * 		schema's, so the rejection reads as a rule instead of a decode failure
 */
export type TakeActionInput = typeof TakeActionInput.Type;
export const TakeActionInput = Schema.Struct( {
	action: ActionKind,
	target: Schema.optional( PlayerId )
} );

/**
 * The input required to answer a challenge window.
 * - challenge: `true` to call the claim a bluff, `false` to let it stand
 */
export type ChallengeInput = typeof ChallengeInput.Type;
export const ChallengeInput = Schema.Struct( {
	challenge: Schema.Boolean
} );

/**
 * The input required to answer a block window.
 * - block: The character being claimed to stop the action, or `null` to allow it.
 * 		`null` rather than an absent key so a pass is a decision a responder made
 * 		rather than a message that went missing
 */
export type BlockInput = typeof BlockInput.Type;
export const BlockInput = Schema.Struct( {
	block: Schema.NullOr( CharacterCard )
} );

/**
 * The input required to give up an influence.
 * - card: Which of the seat's own cards is given up. It is named to the table and
 * 		then returns to the deck
 */
export type SurrenderInfluenceInput = typeof SurrenderInfluenceInput.Type;
export const SurrenderInfluenceInput = Schema.Struct( {
	card: CharacterCard
} );

/**
 * The input required to finish an exchange.
 * - keep: The cards the seat is keeping, exactly as many as it had influences
 * 		before it drew. Everything else goes back to the deck
 */
export type ExchangeCardsInput = typeof ExchangeCardsInput.Type;
export const ExchangeCardsInput = Schema.Struct( {
	keep: Schema.Array( CharacterCard )
} );

/**
 * The input required to initialize a coup game.
 */
export type CoupInitializeInput = typeof CoupInitializeInput.Type;
export const CoupInitializeInput = InitializeInput( CoupConfig );

/**
 * The input required to create a coup game.
 * - playerCount: How many seats to lay out
 */
export type CoupCreateInput = typeof CoupCreateInput.Type;
export const CoupCreateInput = Schema.Struct( {
	playerCount: Schema.Literals( COUP_PLAYER_COUNTS )
} );

/** Every move the game takes, keyed by name, for typing the API handlers. */
export type CoupMoves = {
	takeAction: TakeActionInput;
	challenge: ChallengeInput;
	block: BlockInput;
	surrenderInfluence: SurrenderInfluenceInput;
	exchangeCards: ExchangeCardsInput;
};


// --- Domain Events ---------------------------------------------------------

/**
 * Emitted once at the start, giving every seat its two cards and two coins and
 * recording the deck the rest of the game draws from.
 *
 * The whole deal rides one event rather than one per seat because it is one
 * shuffle: a replay that folded them separately could interleave them with
 * something else and end up dealing a different game.
 */
export type GameDealt = typeof GameDealt.Type;
export const GameDealt = Schema.TaggedStruct( "coup/ev/GameDealt", {
	hands: Schema.Record( PlayerId, Schema.Array( CharacterCard ) ),
	coins: PositiveInt,
	deck: Schema.Array( CharacterCard )
} );

/** Emitted when a seat declares an action, opening everything that follows. */
export type ActionDeclared = typeof ActionDeclared.Type;
export const ActionDeclared = Schema.TaggedStruct( "coup/ev/ActionDeclared", {
	pending: PendingAction
} );

/**
 * Emitted whenever a seat's treasury moves, by however much and in whichever
 * direction. One event for gains and losses alike, since `delta` carries the
 * sign and a reducer that had to pick between two tags would only ever add up to
 * the same sum.
 */
export type CoinsChanged = typeof CoinsChanged.Type;
export const CoinsChanged = Schema.TaggedStruct( "coup/ev/CoinsChanged", {
	playerId: PlayerId,
	delta: Schema.Int,
	reason: Schema.NonEmptyString
} );

/** Emitted when a seat calls a claim a bluff. */
export type ChallengeMade = typeof ChallengeMade.Type;
export const ChallengeMade = Schema.TaggedStruct( "coup/ev/ChallengeMade", {
	challenger: PlayerId,
	claimant: PlayerId,
	claim: CharacterCard
} );

/** Emitted when the challenged seat held the card after all. */
export type ChallengeFailed = typeof ChallengeFailed.Type;
export const ChallengeFailed = Schema.TaggedStruct( "coup/ev/ChallengeFailed", {
	challenger: PlayerId,
	claimant: PlayerId,
	claim: CharacterCard
} );

/** Emitted when the challenged seat was bluffing. */
export type ChallengeSucceeded = typeof ChallengeSucceeded.Type;
export const ChallengeSucceeded = Schema.TaggedStruct( "coup/ev/ChallengeSucceeded", {
	challenger: PlayerId,
	claimant: PlayerId,
	claim: CharacterCard
} );

/**
 * Emitted when a proven claim is put back and a fresh card taken.
 *
 * Both cards ride the event. The replacement is drawn at resolution and has to
 * be recorded rather than recomputed, and the card going back names which of two
 * identical copies left the hand — without it a replay could return the wrong
 * one and quietly deal a different game.
 */
export type CardSwapped = typeof CardSwapped.Type;
export const CardSwapped = Schema.TaggedStruct( "coup/ev/CardSwapped", {
	playerId: PlayerId,
	returned: CharacterCard,
	drawn: CharacterCard,
	deck: Schema.Array( CharacterCard )
} );

/** Emitted when a seat plays a character to stop the action in flight. */
export type ActionBlocked = typeof ActionBlocked.Type;
export const ActionBlocked = Schema.TaggedStruct( "coup/ev/ActionBlocked", {
	by: PlayerId,
	card: CharacterCard
} );

/** Emitted when an action lands, after everything that could have stopped it did not. */
export type ActionResolved = typeof ActionResolved.Type;
export const ActionResolved = Schema.TaggedStruct( "coup/ev/ActionResolved", {
	action: ActionKind,
	actor: PlayerId,
	target: Schema.optional( PlayerId )
} );

/** Emitted when an action does not happen — blocked, or its claim disproved. */
export type ActionFizzled = typeof ActionFizzled.Type;
export const ActionFizzled = Schema.TaggedStruct( "coup/ev/ActionFizzled", {
	action: ActionKind,
	actor: PlayerId,
	reason: Schema.NonEmptyString
} );

/**
 * Emitted when a seat gives one of its cards up.
 *
 * The card is named — that is what the table sees and what the log records — and
 * then goes back into the deck, which is why the new deck rides the event. It is
 * recorded rather than recomputed for the same reason a swap's is: the card is
 * shuffled in at resolution, and a replay folds the outcome instead of drawing
 * again.
 */
export type InfluenceLost = typeof InfluenceLost.Type;
export const InfluenceLost = Schema.TaggedStruct( "coup/ev/InfluenceLost", {
	playerId: PlayerId,
	card: CharacterCard,
	deck: Schema.Array( CharacterCard )
} );

/**
 * Emitted when a seat turns over its last card.
 *
 * The seat's *status* is the engine's to change — this is the game's own record
 * of the order people went out in, which is what the final ranking is built
 * from. The two travel together and neither replaces the other.
 */
export type PlayerEliminated = typeof PlayerEliminated.Type;
export const PlayerEliminated = Schema.TaggedStruct( "coup/ev/PlayerEliminated", {
	playerId: PlayerId
} );

/** Emitted when an Ambassador's draw comes off the deck and into their choice. */
export type ExchangeDrawn = typeof ExchangeDrawn.Type;
export const ExchangeDrawn = Schema.TaggedStruct( "coup/ev/ExchangeDrawn", {
	playerId: PlayerId,
	drawn: Schema.Array( CharacterCard ),
	deck: Schema.Array( CharacterCard )
} );

/** Emitted when the exchanging seat has chosen, and the rest goes back. */
export type ExchangeCompleted = typeof ExchangeCompleted.Type;
export const ExchangeCompleted = Schema.TaggedStruct( "coup/ev/ExchangeCompleted", {
	playerId: PlayerId,
	kept: Schema.Array( CharacterCard ),
	deck: Schema.Array( CharacterCard )
} );

/** Emitted when a turn's action is finished with, whichever way it went. */
export type PendingCleared = typeof PendingCleared.Type;
export const PendingCleared = Schema.TaggedStruct( "coup/ev/PendingCleared", {} );

/** Emitted to append one line to the table's history. */
export type Logged = typeof Logged.Type;
export const Logged = Schema.TaggedStruct( "coup/ev/Logged", {
	entry: LogEntry
} );

/**
 * Union of all the events a coup game emits.
 */
export type CoupEvent = typeof CoupEvent.Type;
export const CoupEvent = Schema.Union( [
	GameDealt,
	ActionDeclared,
	CoinsChanged,
	ChallengeMade,
	ChallengeFailed,
	ChallengeSucceeded,
	CardSwapped,
	ActionBlocked,
	ActionResolved,
	ActionFizzled,
	InfluenceLost,
	PlayerEliminated,
	ExchangeDrawn,
	ExchangeCompleted,
	PendingCleared,
	Logged
] );
