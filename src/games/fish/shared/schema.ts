import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { CardId } from "@/shared/cards/schema.ts";
import {
	BaseGameConfig,
	GameData,
	InitializeInput,
	PlayerId,
	SeatView,
	TeamId
} from "@/swish/shared/schema.ts";


// --- Book Primitives ---------------------------------------------

export type BookType = typeof BookType.Type;
export const BookType = Schema.Literals( [ "NORMAL", "CANADIAN" ] );

export type NormalBook = typeof NormalBook.Type;
export const NormalBook = Schema.Literals( [
	"ACES",
	"TWOS",
	"THREES",
	"FOURS",
	"FIVES",
	"SIXES",
	"SEVENS",
	"EIGHTS",
	"NINES",
	"TENS",
	"JACKS",
	"QUEENS",
	"KINGS"
] );

export type CanadianBook = typeof CanadianBook.Type;
export const CanadianBook = Schema.Literals( [ "LC", "LD", "LH", "LS", "UC", "UD", "UH", "US" ] );

export type Book = typeof Book.Type;
export const Book = Schema.Union( [ NormalBook, CanadianBook ] );


// --- Fish Primitives ---------------------------------------------

/**
 * What one seat did with its game: how much it asked for, how much was asked of
 * it, and how its declarations came out.
 *
 * Counted out of the histories by `getMetrics` rather than tallied into the state
 * as the game runs — the histories already hold every event these count, and a
 * second copy kept in step by hand could only ever disagree with them.
 *
 * - totalAsks: Asks this seat made
 * - cardsTaken: How many of them landed
 * - cardsGiven: Cards asked off this seat by someone else
 * - totalClaims: Books this seat declared
 * - successfulClaims: How many it got right. The rest it handed to the other side
 */
export type Metrics = typeof Metrics.Type;
export const Metrics = Schema.Struct( {
	totalAsks: Schema.Number,
	cardsTaken: Schema.Number,
	cardsGiven: Schema.Number,
	totalClaims: Schema.Number,
	successfulClaims: Schema.Number
} );

/**
 * One seat asking another for a card, and whether it landed.
 *
 * Tagged, like the other two, because they share one ordered history now:
 * `FishMove` is a discriminated union and every reader of the table's story —
 * the metrics, the deductions, the client's feed — dispatches on the tag.
 */
export type Ask = typeof Ask.Type;
export const Ask = Schema.TaggedStruct( "fish/Ask", {
	success: Schema.Boolean,
	playerId: PlayerId,
	from: PlayerId,
	cardId: CardId
} );

/**
 * A book being declared, and how it came out.
 * - success: Whether `actualClaim` matched where the cards really were
 * - playerId: The player who declared
 * - book: The book being declared
 * - correctClaim: Where the book's cards really were, card → holder
 * - actualClaim: Where the declaring player said they were, card → holder
 * - timestamp: When the declaration was made
 *
 * The side the book goes to is deliberately not recorded here: it follows from
 * `success`, the declarer's side and `correctClaim`, all of which are already in
 * the event, so `getBookWinner` derives it rather than a second field carrying a
 * verdict that could disagree with them.
 */
export type Claim = typeof Claim.Type;
export const Claim = Schema.TaggedStruct( "fish/Claim", {
	success: Schema.Boolean,
	playerId: PlayerId,
	book: Book,
	correctClaim: Schema.Record( Schema.String, PlayerId ),
	actualClaim: Schema.Record( Schema.String, PlayerId )
} );

/**
 * A turn being transferred to a team mate.
 * - playerId: The player who is transferring the turn
 * - transferTo: The player receiving the turn
 */
export type Transfer = typeof Transfer.Type;
export const Transfer = Schema.TaggedStruct( "fish/Transfer", {
	playerId: PlayerId,
	transferTo: PlayerId
} );

/**
 * Everything that can happen at a fish table, as one type.
 *
 * The three used to be kept in three arrays, which recorded *what* happened of
 * each kind but nothing about how they interleaved — so no reader could put the
 * table's story back in order, and the client's feed had to present them apart
 * rather than invent a sequence. One ordered list is the whole fix: the order is
 * the order they were appended in, and `at( -1 )` is simply the last move, which
 * is also what makes `transferTurn`'s window expire without a second field
 * tracking it.
 */
export type FishMove = typeof FishMove.Type;
export const FishMove = Schema.Union( [ Ask, Claim, Transfer ] );


// --- Config / State / Views ------------------------------------------------------

export type PlayerCount = typeof PlayerCount.Type;
export const PlayerCount = Schema.Literals( [ 4, 6, 8 ] );

/**
 * How long a seat may hold its turn. A fish turn is a choice of card *and* of
 * target, so it is longer than a board game's.
 *
 * A table without one cannot be rescued from a seat that walks away: an expired
 * clock is what hands a seat to `botMove` — and leaves it there until its player
 * takes it back — so a silent player stalls everyone else indefinitely without it.
 */
export const FISH_MOVE_TIMEOUT_MILLIS = 45_000;

/**
 * How many sides a table is played in. Only a count that divides `playerCount`
 * evenly can be seated — swish sides are equal-sized and `initialize` refuses
 * anything else with `InvalidTeamConfig` — so the pair is chosen together, and
 * `teamCountsFor` is what a client offers for a given seat count.
 *
 * This is a creation-time choice only. Once the config is built the count is
 * `teams.length`; nothing downstream reads it back.
 */
export type TeamCount = typeof TeamCount.Type;
export const TeamCount = Schema.Literals( [ 2, 3, 4 ] );

/**
 * What a table was created with. Extends `BaseGameConfig`.
 * - playerCount: Seats at the table
 * - type: Which variant is being played, which is what fixes the rest
 * - teams: The sides, in the order they are listed. Required here, though
 * 			`BaseGameConfig` leaves it optional: fish is always played in sides, and
 * 			declaring them is what makes swish seat them interleaved, balance whoever
 * 			picked nothing, and rank the sides at the end
 * - deckType: How many cards the deck holds
 * - books: Every book in play for this variant
 * - bookSize: How many cards one book holds
 */
export type FishConfig = typeof FishConfig.Type;
export const FishConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	playerCount: PlayerCount,
	type: BookType,
	teams: Schema.Array( TeamId ),
	deckType: Schema.Literals( [ 48, 52 ] ),
	books: Schema.Array( Book ),
	bookSize: Schema.Literals( [ 4, 6 ] )
} );

/**
 * The table as the engine holds it.
 *
 * - hands: Every seat's cards. The only private region, and the only thing the
 * 			view redacts
 * - cardCounts: How many cards each seat holds, public and always in step with
 * 			`hands`
 * - moves: Everything that has happened, oldest first, in one list
 *
 * What the previous move was is deliberately not a field of its own: it is
 * `moves.at( -1 )`, and a second copy kept in step by hand is exactly the kind of
 * thing that drifts. `transferTurn`'s window reads it there.
 *
 * Where the cards *might* be is deliberately not here either. It follows from the
 * asks, the declarations and the counts — all of which are in this state and in
 * every view of it — so `possibleHolders` derives it on demand rather than a
 * stored map being maintained in step by hand. One derivation, no staleness, and a
 * client can run the same one the bot does.
 */
export type FishState = typeof FishState.Type;
export const FishState = Schema.Struct( {
	hands: Schema.Record( PlayerId, Schema.Array( CardId ) ),
	cardCounts: Schema.Record( PlayerId, Schema.Number ),
	moves: Schema.Array( FishMove )
} );

export type FishData = typeof FishData.Type;
export const FishData = GameData( FishState, FishConfig );

/**
 * One shape for every audience. What varies is whose hand is filled in, not which
 * fields exist: the table's view carries an empty `hand` and no `playerId`, a
 * seat's carries its own cards. Everything else — the counts, the deductions and
 * the three histories — is public knowledge at a fish table and is the same
 * whoever is watching.
 *
 * The hidden information is modelled explicitly rather than by omission:
 * `cardCounts` says how many cards each seat holds and `possibleHolders` who could
 * still be holding what, so one client renderer serves players and spectators.
 *
 * - playerId: The seat this view was built for. Absent on the table's
 * - hand: That seat's cards. Empty on the table's, and for a seat that has run out
 * - metrics: How every seat played, once the last book has been declared. Absent
 * 			while the game is still on — it is an end-of-game summary, and the
 * 			histories it is folded from are there to read in the meantime
 */
export type FishView = typeof FishView.Type;
export const FishView = Schema.Struct( {
	...FishState.mapFields( Struct.omit( [ "hands" ] ) ).fields,
	playerId: Schema.optional( PlayerId ),
	hand: Schema.Array( CardId ),
	metrics: Schema.optional( Schema.Record( PlayerId, Metrics ) )
} );

/** The table as one of its seats sees it — {@link SeatView} over the view above. */
export type FishSeatView = typeof FishSeatView.Type;
export const FishSeatView = SeatView( FishView );

/**
 * What the bot decides from. The engine only ever plays a seat through that seat's
 * own audience, so the policy narrows to `FishSeatView` once on the way in and
 * reads its own hand from there — it never sees more than the player it plays for.
 */
export type FishBotData = GameData<FishSeatView, FishConfig>;


// --- Move Inputs ------------------------------------------------------

export type AskCardInput = typeof AskCardInput.Type;
export const AskCardInput = Schema.Struct( {
	from: PlayerId,
	cardId: CardId
} );

export type ClaimBookInput = typeof ClaimBookInput.Type;
export const ClaimBookInput = Schema.Struct( {
	claim: Schema.Record( Schema.String, PlayerId )
} );

export type TransferTurnInput = typeof TransferTurnInput.Type;
export const TransferTurnInput = Schema.Struct( {
	transferTo: PlayerId
} );

export type FishInitializeInput = typeof FishInitializeInput.Type;
export const FishInitializeInput = InitializeInput( FishConfig );

/**
 * The input required to create a fish game: how many seats, which variant, and how
 * many sides to split them between.
 *
 * Everything else about the table follows from those three — the deck, the books,
 * how big a book is, the sides' ids and the move clock — and `buildConfig` derives
 * it server-side. That is why the config itself is not the payload: a client
 * sending its own `books` or a `bookSize` that disagreed with the variant would be
 * describing a table the rules don't hold for.
 *
 * - playerCount: Seats at the table
 * - type: Which variant is being played
 * - teamCount: How many sides, which must divide `playerCount` — `teamCountsFor`
 * 			lists the counts a given seat count allows
 */
export type FishCreateInput = typeof FishCreateInput.Type;
export const FishCreateInput = Schema.Struct( {
	playerCount: PlayerCount,
	type: BookType,
	teamCount: TeamCount
} );

// --- Domain Events ----------------------------------------------------------

export type HandsDealt = typeof HandsDealt.Type;
export const HandsDealt = Schema.TaggedStruct( "fish/ev/HandsDealt", {
	hands: Schema.Record( PlayerId, Schema.Array( CardId ) ),
	cardCounts: Schema.Record( PlayerId, Schema.Number )
} );

export type CardAsked = typeof CardAsked.Type;
export const CardAsked = Schema.TaggedStruct( "fish/ev/CardAsked", { ask: Ask } );

export type BookClaimed = typeof BookClaimed.Type;
export const BookClaimed = Schema.TaggedStruct( "fish/ev/BookClaimed", { claim: Claim } );

export type TurnTransferred = typeof TurnTransferred.Type;
export const TurnTransferred = Schema.TaggedStruct(
	"fish/ev/TurnTransferred",
	{ transfer: Transfer }
);

/**
 * Union of all the events a fish game emits.
 */
export type FishEvent = typeof FishEvent.Type;
export const FishEvent = Schema.Union( [
	HandsDealt,
	CardAsked,
	BookClaimed,
	TurnTransferred
] );
