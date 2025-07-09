import * as v from "valibot";

const ulid = () => v.pipe( v.string(), v.trim(), v.ulid() );

export const createGameInputSchema = v.object( {
	wordCount: v.pipe( v.number(), v.gtValue( 0 ) ),
	wordLength: v.pipe( v.number(), v.picklist( [ 5 ] ) )
} );

export type CreateGameInput = v.InferOutput<typeof createGameInputSchema>;

export const makeGuessInputSchema = v.object( {
	gameId: ulid(),
	guess: v.pipe( v.string(), v.length( 5 ) )
} );

export type MakeGuessInput = v.InferOutput<typeof makeGuessInputSchema>;

export const gameIdInputSchema = v.object( { gameId: ulid() } );

export type GameIdInput = v.InferOutput<typeof gameIdInputSchema>;