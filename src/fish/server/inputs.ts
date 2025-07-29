import { cardId, ulid } from "@/shared/utils/validation";
import { any, array, length, number, object, optional, picklist, pipe, record, string, trim } from "valibot";

export const createGameInputSchema = object( {
	playerCount: optional( pipe( number(), picklist( [ 3, 4, 6, 8 ] ) ) ),
	gameId: optional( ulid() ),
	playerId: optional( ulid() )
} );

export const joinGameInputSchema = object( {
	code: pipe( string(), trim(), length( 6 ) )
} );

export const createTeamsInputSchema = object( {
	gameId: ulid(),
	data: record( string(), array( ulid() ) )
} );

export const transferTurnInputSchema = object( {
	gameId: ulid(),
	transferTo: ulid()
} );

export const callSetInputSchema = object( {
	gameId: ulid(),
	data: any()
} );

export const askCardInputSchema = object( {
	gameId: ulid(),
	from: ulid(),
	card: cardId()
} );