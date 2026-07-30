import { CardId } from "@/shared/cards/schema";
import {
	BaseGameConfig,
	GameSnapshot,
	InitializeInput,
	MovePayload,
	PlayerId
} from "@/shared/swish/schema";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";


// --- Primitives ---------------------------------------------

export type BookType = typeof BookType.Type;
export const BookType = Schema.Literals( [ "NORMAL", "CANADIAN" ] );

export type Book = typeof Book.Type;
export const Book = Schema.String;

export type MoveType = typeof MoveType.Type;
export const MoveType = Schema.Literals( [ "ask", "claim", "transfer" ] );

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
	cardId: CardId,
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


// --- Config / State / Views ------------------------------------------------------

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
	hands: Schema.Record( PlayerId, Schema.Array( CardId ) ),
	cardCounts: Schema.Record( PlayerId, Schema.Number ),
	cardLocations: Schema.Record( Schema.String, Schema.Array( PlayerId ) ),
	lastMoveType: Schema.optional( MoveType ),
	askHistory: Schema.Array( Ask ),
	claimHistory: Schema.Array( Claim ),
	transferHistory: Schema.Array( Transfer ),
	winningTeam: Schema.optional( Schema.String )
} );

// The table view hides every hand; a player's view adds its own (required) id and
// hand. `FishView` is the discriminated union — clients (and bots) narrow once on
// `_tag` instead of null-checking the private slice. The player variant doubles as
// the bot's input (it carries the full `shared & private` shape).
export type FishSharedView = typeof FishSharedView.Type;
export const FishSharedView = Schema.Struct( {
	...FishState.mapFields( Struct.omit( [ "hands" ] ) ).fields
} );

export type FishPlayerView = typeof FishPlayerView.Type;
export const FishPlayerView = Schema.TaggedStruct( "fish/PlayerView", {
	...FishSharedView.fields,
	playerId: PlayerId,
	hand: Schema.Array( CardId )
} );

export type FishTableView = typeof FishTableView.Type;
export const FishTableView = Schema.TaggedStruct( "fish/TableView", {
	...FishSharedView.fields
} );

export type FishView = typeof FishView.Type;
export const FishView = Schema.Union( [ FishPlayerView, FishTableView ] );

export type FishSnapshot = typeof FishSnapshot.Type;
export const FishSnapshot = GameSnapshot( FishView, FishConfig );


// --- Move Inputs ------------------------------------------------------

export type CreateTeamsInput = typeof CreateTeamsInput.Type;
export const CreateTeamsInput = Schema.Struct( {
	teams: Schema.Record( Schema.String, Schema.Array( PlayerId ) )
} );

export type CreateTeamsMovePayload = typeof CreateTeamsMovePayload.Type;
export const CreateTeamsMovePayload = MovePayload( CreateTeamsInput );

export type AskCardInput = typeof AskCardInput.Type;
export const AskCardInput = Schema.Struct( {
	from: PlayerId,
	cardId: CardId
} );

export type AskCardMovePayload = typeof AskCardMovePayload.Type;
export const AskCardMovePayload = MovePayload( AskCardInput );

export type ClaimBookInput = typeof ClaimBookInput.Type;
export const ClaimBookInput = Schema.Struct( {
	claim: Schema.Record( Schema.String, PlayerId )
} );

export type ClaimBookMovePayload = typeof ClaimBookMovePayload.Type;
export const ClaimBookMovePayload = MovePayload( ClaimBookInput );

export type TransferTurnInput = typeof TransferTurnInput.Type;
export const TransferTurnInput = Schema.Struct( {
	transferTo: PlayerId
} );

export type TransferTurnMovePayload = typeof TransferTurnMovePayload.Type;
export const TransferTurnMovePayload = MovePayload( TransferTurnInput );

export type FishInitializeInput = typeof FishInitializeInput.Type;
export const FishInitializeInput = InitializeInput( FishConfig );

// --- Domain Events ----------------------------------------------------------

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
	hands: Schema.Record( PlayerId, Schema.Array( CardId ) ),
	cardCounts: Schema.Record( PlayerId, Schema.Number ),
	cardLocations: Schema.Record( Schema.String, Schema.Array( PlayerId ) )
} );

export type CardAsked = typeof CardAsked.Type;
export const CardAsked = Schema.TaggedStruct( "fish/CardAsked", {
	success: Schema.Boolean,
	playerId: PlayerId,
	from: PlayerId,
	cardId: CardId,
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
