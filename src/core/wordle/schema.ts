import { ulidSchema } from "@/utils/schema";
import {
	array,
	boolean,
	gtValue,
	type InferInput,
	length,
	number,
	object,
	omit,
	optional,
	picklist,
	pipe,
	string
} from "valibot";

export type PositionData = InferInput<typeof positionDataSchema>;
export const positionDataSchema = object( {
	letter: string(),
	state: picklist( [ "correct", "wrongPlace", "wrong", "empty" ] ),
	index: number()
} );

export type GameData = InferInput<typeof gameDataSchema>;
export const gameDataSchema = object( {
	id: ulidSchema(),
	playerId: ulidSchema(),
	wordCount: pipe( number(), gtValue( 0 ) ),
	wordLength: pipe( number(), picklist( [ 5 ] ) ),
	words: array( pipe( string(), length( 5 ) ) ),
	guesses: array( pipe( string(), length( 5 ) ) ),
	guessBlocks: array( array( array( positionDataSchema ) ) ),
	completedWords: array( pipe( string(), length( 5 ) ) ),
	completed: boolean()
} );

export type PlayerGameInfo = InferInput<typeof playerGameInfoSchema>;
export const playerGameInfoSchema = omit( gameDataSchema, [ "words" ] );

export type GameIdInput = { gameId: string };

export type CreateGameInput = InferInput<typeof createGameInputSchema>;
export const createGameInputSchema = object( {
	wordCount: optional( pipe( number(), gtValue( 0 ) ) ),
	wordLength: optional( pipe( number(), picklist( [ 5 ] ) ) ),
	gameId: optional( ulidSchema() )
} );

export type MakeGuessInput = InferInput<typeof makeGuessInputSchema>;
export const makeGuessInputSchema = object( {
	gameId: ulidSchema(),
	guess: pipe( string(), length( 5 ) )
} );
