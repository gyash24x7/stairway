import { ulid } from "@/shared/utils/validation";
import { gtValue, length, number, object, picklist, pipe, string } from "valibot";

export const createGameInputSchema = object( {
	wordCount: pipe( number(), gtValue( 0 ) ),
	wordLength: pipe( number(), picklist( [ 5 ] ) )
} );

export const makeGuessInputSchema = object( {
	gameId: ulid(),
	guess: pipe( string(), length( 5 ) )
} );
