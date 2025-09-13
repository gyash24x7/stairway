import { CARD_IDS } from "@/core/cards/constants";
import { playingCardSchema } from "@/core/cards/types";
import { CANADIAN_BOOKS, GAME_STATUS, NORMAL_BOOKS } from "@/core/fish/constants";
import { ulidSchema } from "@/utils/schema";
import { authInfoSchema } from "@/workers/auth/schema";
import {
	array,
	boolean,
	type InferInput,
	intersect,
	length,
	number,
	object,
	omit,
	optional,
	picklist,
	pipe,
	record,
	string,
	trim,
	union
} from "valibot";

export type BookType = InferInput<typeof bookTypeSchema>;
export const bookTypeSchema = picklist( [ "NORMAL", "CANADIAN" ] );

export type PlayerCount = InferInput<typeof playerCountSchema>;
export const playerCountSchema = picklist( [ 3, 4, 6, 8 ] );

export type TeamCount = InferInput<typeof teamCountSchema>;
export const teamCountSchema = picklist( [ 0, 2, 3, 4 ] );

export type CanadianBook = InferInput<typeof canadianBookSchema>;
export const canadianBookSchema = picklist( Object.keys( CANADIAN_BOOKS ) as ( keyof typeof CANADIAN_BOOKS )[] );

export type NormalBook = InferInput<typeof normalBookSchema>;
export const normalBookSchema = picklist( Object.keys( NORMAL_BOOKS ) as ( keyof typeof NORMAL_BOOKS )[] );

export type Book = InferInput<typeof bookSchema>;
export const bookSchema = union( [ normalBookSchema, canadianBookSchema ] );

export type DeckType = InferInput<typeof deckTypeSchema>;
export const deckTypeSchema = picklist( [ 48, 52 ] );

export type GameConfig = InferInput<typeof gameConfigSchema>;
export const gameConfigSchema = object( {
	type: bookTypeSchema,
	playerCount: playerCountSchema,
	teamCount: teamCountSchema,
	deckType: deckTypeSchema,
	books: array( bookSchema ),
	allowSolo: optional( boolean() )
} );

export type PlayerId = string;
export type Player = InferInput<typeof playerSchema>;
export const playerSchema = intersect( [
	authInfoSchema,
	object( {
		teamId: ulidSchema(),
		isBot: boolean(),
		teamMates: array( ulidSchema() ),
		opponents: array( ulidSchema() )
	} )
] );

export type TeamId = string;
export type Team = InferInput<typeof teamSchema>;
export const teamSchema = object( {
	id: ulidSchema(),
	name: string(),
	players: array( ulidSchema() ),
	score: number(),
	booksWon: array( bookSchema )
} );

export type GameStatus = InferInput<typeof gameStatusSchema>;
export const gameStatusSchema = picklist( Object.keys( GAME_STATUS ) as ( keyof typeof GAME_STATUS )[] );

export type BookState = InferInput<typeof bookStateSchema>;
export const bookStateSchema = object( {
	cards: array( picklist( CARD_IDS ) ),
	knownOwners: record( picklist( CARD_IDS ), ulidSchema() ),
	possibleOwners: record( picklist( CARD_IDS ), array( ulidSchema() ) ),
	knownCounts: record( ulidSchema(), number() ),
	inferredOwners: record( picklist( CARD_IDS ), ulidSchema() )
} );

export type AskEvent = InferInput<typeof askEventSchema>;
export const askEventSchema = object( {
	success: boolean(),
	description: string(),
	playerId: ulidSchema(),
	from: ulidSchema(),
	cardId: picklist( CARD_IDS ),
	timestamp: number()
} );

export type ClaimEvent = InferInput<typeof claimEventSchema>;
export const claimEventSchema = object( {
	success: boolean(),
	description: string(),
	playerId: ulidSchema(),
	book: bookSchema,
	correctClaim: record( picklist( CARD_IDS ), ulidSchema() ),
	actualClaim: record( picklist( CARD_IDS ), ulidSchema() ),
	timestamp: number()
} );

export type TransferEvent = InferInput<typeof transferEventSchema>;
export const transferEventSchema = object( {
	description: string(),
	playerId: ulidSchema(),
	transferTo: ulidSchema(),
	timestamp: number()
} );

export type Metrics = InferInput<typeof metricsSchema>;
export const metricsSchema = object( {
	totalAsks: number(),
	cardsTaken: number(),
	cardsGiven: number(),
	totalClaims: number(),
	successfulClaims: number()
} );

export type GameId = string;
export type GameData = InferInput<typeof gameDataSchema>;
export const gameDataSchema = object( {
	id: ulidSchema(),
	code: pipe( string(), length( 6 ) ),
	status: gameStatusSchema,
	config: gameConfigSchema,
	currentTurn: ulidSchema(),
	playerIds: array( ulidSchema() ),
	players: record( ulidSchema(), playerSchema ),
	teamIds: array( ulidSchema() ),
	teams: record( ulidSchema(), teamSchema ),
	hands: record( ulidSchema(), array( picklist( CARD_IDS ) ) ),
	cardCounts: record( ulidSchema(), number() ),
	cardMappings: record( picklist( CARD_IDS ), ulidSchema() ),
	bookStates: record( bookSchema, bookStateSchema ),
	lastMoveType: optional( picklist( [ "ask", "claim", "transfer" ] ) ),
	askHistory: array( askEventSchema ),
	claimHistory: array( claimEventSchema ),
	transferHistory: array( transferEventSchema ),
	metrics: record( ulidSchema(), metricsSchema )
} );

export type PlayerGameInfo = InferInput<typeof playerGameInfoSchema>;
export const playerGameInfoSchema = intersect( [
	omit( gameDataSchema, [ "hands", "cardMappings" ] ),
	object( { playerId: ulidSchema(), hand: array( playingCardSchema ) } )
] );

export type WeightedBook = InferInput<typeof weightedBookSchema>;
export const weightedBookSchema = object( {
	book: bookSchema,
	weight: number(),
	isBookWithTeam: boolean(),
	isClaimable: boolean(),
	isKnown: boolean()
} );

export type WeightedAsk = InferInput<typeof weightedAskSchema>;
export const weightedAskSchema = object( {
	cardId: picklist( CARD_IDS ),
	playerId: ulidSchema(),
	weight: number()
} );

export type WeightedClaim = InferInput<typeof weightedClaimSchema>;
export const weightedClaimSchema = object( {
	book: bookSchema,
	claim: record( picklist( CARD_IDS ), ulidSchema() ),
	weight: number()
} );

export type WeightedTransfer = InferInput<typeof weightedTransferSchema>;
export const weightedTransferSchema = object( {
	weight: number(),
	transferTo: ulidSchema()
} );

export type CreateGameInput = InferInput<typeof createGameInputSchema>;
export const createGameInputSchema = object( {
	playerCount: optional( picklist( [ 3, 4, 6, 8 ] ) )
} );

export type JoinGameInput = InferInput<typeof joinGameInputSchema>;
export const joinGameInputSchema = object( {
	code: pipe( string(), trim(), length( 6 ) )
} );

export type GameIdInput = { gameId: GameId };

export type CreateTeamsInput = InferInput<typeof createTeamsInputSchema>;
export const createTeamsInputSchema = object( {
	gameId: ulidSchema(),
	data: record( string(), array( ulidSchema() ) )
} );

export type StartGameInput = InferInput<typeof startGameInputSchema>;
export const startGameInputSchema = object( {
	gameId: ulidSchema(),
	type: pipe( picklist( [ "NORMAL", "CANADIAN" ] ) ),
	deckType: pipe( picklist( [ 48, 52 ] ) )
} );

export type AskEventInput = InferInput<typeof askEventInputSchema>;
export const askEventInputSchema = object( {
	gameId: ulidSchema(),
	from: ulidSchema(),
	cardId: picklist( CARD_IDS )
} );

export type ClaimEventInput = InferInput<typeof claimEventInputSchema>;
export const claimEventInputSchema = object( {
	gameId: ulidSchema(),
	claim: record( picklist( CARD_IDS ), ulidSchema() )
} );

export type TransferEventInput = InferInput<typeof transferEventInputSchema>;
export const transferEventInputSchema = object( {
	gameId: ulidSchema(),
	transferTo: ulidSchema()
} );