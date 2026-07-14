// @s2h/fish/schema — Effect Schema definitions for Fish (Literature).
//
// Pure / browser-safe: imports only `effect` + `@s2h/swish/schema`. Holds the
// game's data shapes (config/state/views), its move-input schemas, and its
// domain-event union. Nondeterministic facts (team ids, the shuffled deal,
// timestamps, computed claim resolutions) are carried in the event payloads so
// the `apply` reducer in ./utils stays pure. Dual const+type exports throughout.

import { BaseGameConfig, type BaseGameData, GameSnapshot, PlayerId } from "@s2h/swish/schema";
import { SORTED_DECK } from "@s2h/utils/cards";
import * as Schema from "effect/Schema";

// --- Primitive game vocabulary ---------------------------------------------

export type BookType = typeof BookType.Type;
export const BookType = Schema.Literals( [ "NORMAL", "CANADIAN" ] );

export type Card = typeof Card.Type;
export const Card = Schema.Literals( SORTED_DECK );

/** A book name — normal (rank) or Canadian (suit-half). Kept as a plain string. */
export type Book = typeof Book.Type;
export const Book = Schema.String;

export type MoveType = typeof MoveType.Type;
export const MoveType = Schema.Literals( [ "ask", "claim", "transfer" ] );

// --- Structs ----------------------------------------------------------------

export type Metrics = typeof Metrics.Type;
export const Metrics = Schema.Struct( {
	totalAsks: Schema.Number,
	cardsTaken: Schema.Number,
	cardsGiven: Schema.Number,
	totalClaims: Schema.Number,
	successfulClaims: Schema.Number
} );

export type Team = typeof Team.Type;
export const Team = Schema.Struct( {
	id: Schema.String,
	name: Schema.String,
	members: Schema.Array( PlayerId ),
	score: Schema.Number,
	booksWon: Schema.Array( Book )
} );

export type PlayerInfoData = typeof PlayerInfoData.Type;
export const PlayerInfoData = Schema.Struct( {
	teamId: Schema.String,
	metrics: Metrics
} );

export type Ask = typeof Ask.Type;
export const Ask = Schema.Struct( {
	success: Schema.Boolean,
	playerId: PlayerId,
	from: PlayerId,
	cardId: Card,
	timestamp: Schema.Number
} );

export type Claim = typeof Claim.Type;
export const Claim = Schema.Struct( {
	success: Schema.Boolean,
	playerId: PlayerId,
	book: Book,
	correctClaim: Schema.Record( Schema.String, PlayerId ),
	actualClaim: Schema.Record( Schema.String, PlayerId ),
	timestamp: Schema.Number
} );

export type Transfer = typeof Transfer.Type;
export const Transfer = Schema.Struct( {
	playerId: PlayerId,
	transferTo: PlayerId,
	timestamp: Schema.Number
} );

// --- Config / state / views ------------------------------------------------

export type FishConfig = typeof FishConfig.Type;
export const FishConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	type: BookType,
	teamCount: Schema.Number,
	deckType: Schema.Literals( [ 48, 52 ] ),
	books: Schema.Array( Book ),
	bookSize: Schema.Literals( [ 4, 6 ] )
} );

export type FishState = typeof FishState.Type;
export const FishState = Schema.Struct( {
	playerData: Schema.Record( PlayerId, PlayerInfoData ),
	teams: Schema.Record( Schema.String, Team ),
	hands: Schema.Record( PlayerId, Schema.Array( Card ) ),
	cardCounts: Schema.Record( PlayerId, Schema.Number ),
	cardLocations: Schema.Record( Schema.String, Schema.Array( PlayerId ) ),
	lastMoveType: Schema.optional( MoveType ),
	askHistory: Schema.Array( Ask ),
	claimHistory: Schema.Array( Claim ),
	transferHistory: Schema.Array( Transfer ),
	winningTeam: Schema.optional( Schema.String )
} );

/** Shared view = everything except hands. */
export type FishSharedView = typeof FishSharedView.Type;
export const FishSharedView = Schema.Struct( {
	playerData: Schema.Record( PlayerId, PlayerInfoData ),
	teams: Schema.Record( Schema.String, Team ),
	cardCounts: Schema.Record( PlayerId, Schema.Number ),
	cardLocations: Schema.Record( Schema.String, Schema.Array( PlayerId ) ),
	lastMoveType: Schema.optional( MoveType ),
	askHistory: Schema.Array( Ask ),
	claimHistory: Schema.Array( Claim ),
	transferHistory: Schema.Array( Transfer ),
	winningTeam: Schema.optional( Schema.String )
} );

/** Player view = only the player's own hand. */
export type FishPlayerView = typeof FishPlayerView.Type;
export const FishPlayerView = Schema.Struct( {
	playerId: PlayerId,
	hand: Schema.Array( Card )
} );

/** Merged view fed to the bot AI (shared + player-specific state). */
export type FishBotView = FishSharedView & FishPlayerView;

export type FishSnapshot = typeof FishSnapshot.Type;
export const FishSnapshot = GameSnapshot( FishSharedView, FishPlayerView, FishConfig );

// --- Move inputs -----------------------------------------------------------

export type CreateTeamsInput = typeof CreateTeamsInput.Type;
export const CreateTeamsInput = Schema.Struct( {
	teams: Schema.Record( Schema.String, Schema.Array( PlayerId ) )
} );

export type AskCardInput = typeof AskCardInput.Type;
export const AskCardInput = Schema.Struct( {
	from: PlayerId,
	cardId: Card
} );

export type ClaimBookInput = typeof ClaimBookInput.Type;
export const ClaimBookInput = Schema.Struct( {
	claim: Schema.Record( Schema.String, PlayerId )
} );

export type TransferTurnInput = typeof TransferTurnInput.Type;
export const TransferTurnInput = Schema.Struct( {
	transferTo: PlayerId
} );

// --- Domain events ----------------------------------------------------------
// Nondeterministic inputs (team ids, the shuffled deal, timestamps, computed
// claim resolutions) are captured in the payloads so `apply` stays pure.

export type PlayerSeated = typeof PlayerSeated.Type;
export const PlayerSeated = Schema.TaggedStruct( "fish/PlayerSeated", {
	playerId: PlayerId
} );

export type TeamsCreated = typeof TeamsCreated.Type;
export const TeamsCreated = Schema.TaggedStruct( "fish/TeamsCreated", {
	teams: Schema.Array( Schema.Struct( {
		id: Schema.String,
		name: Schema.String,
		members: Schema.Array( PlayerId )
	} ) )
} );

export type HandsDealt = typeof HandsDealt.Type;
export const HandsDealt = Schema.TaggedStruct( "fish/HandsDealt", {
	hands: Schema.Record( PlayerId, Schema.Array( Card ) ),
	cardCounts: Schema.Record( PlayerId, Schema.Number ),
	cardLocations: Schema.Record( Schema.String, Schema.Array( PlayerId ) )
} );

export type CardAsked = typeof CardAsked.Type;
export const CardAsked = Schema.TaggedStruct( "fish/CardAsked", {
	success: Schema.Boolean,
	playerId: PlayerId,
	from: PlayerId,
	cardId: Card,
	timestamp: Schema.Number
} );

export type BookClaimed = typeof BookClaimed.Type;
export const BookClaimed = Schema.TaggedStruct( "fish/BookClaimed", {
	success: Schema.Boolean,
	playerId: PlayerId,
	book: Book,
	winningTeamId: Schema.String,
	correctClaim: Schema.Record( Schema.String, PlayerId ),
	actualClaim: Schema.Record( Schema.String, PlayerId ),
	timestamp: Schema.Number
} );

export type TurnTransferred = typeof TurnTransferred.Type;
export const TurnTransferred = Schema.TaggedStruct( "fish/TurnTransferred", {
	playerId: PlayerId,
	transferTo: PlayerId,
	timestamp: Schema.Number
} );

export type WinningTeamDecided = typeof WinningTeamDecided.Type;
export const WinningTeamDecided = Schema.TaggedStruct( "fish/WinningTeamDecided", {
	teamId: Schema.String
} );

export type FishEvent = typeof FishEvent.Type;
export const FishEvent = Schema.Union( [
	PlayerSeated,
	TeamsCreated,
	HandsDealt,
	CardAsked,
	BookClaimed,
	TurnTransferred,
	WinningTeamDecided
] );

// --- UI data type -----------------------------------------------------------

/** Complete Fish game data as consumed by the UI: config + shared + player view. */
export type FishData = BaseGameData & {
	config: typeof FishConfig.Type;
	shared: typeof FishSharedView.Type;
	player: typeof FishPlayerView.Type;
};
