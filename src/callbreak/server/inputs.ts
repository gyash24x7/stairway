import { CARD_SUITS } from "@/libs/cards/constants";
import { cardId, ulid } from "@/shared/utils/validation";
import { length, ltValue, number, object, optional, picklist, pipe, string, trim } from "valibot";

export const createGameInputSchema = object( {
	dealCount: optional( pipe( number(), picklist( [ 5, 9, 13 ] ) ) ),
	trumpSuit: picklist( Object.values( CARD_SUITS ) )
} );

export const joinGameInputSchema = object( {
	code: pipe( string(), trim(), length( 6 ) )
} );


export const declareDealWinsInputSchema = object( {
	wins: pipe( number(), ltValue( 13 ) ),
	dealId: ulid(),
	gameId: ulid()
} );

export const playCardInputSchema = object( {
	cardId: cardId(),
	roundId: ulid(),
	dealId: ulid(),
	gameId: ulid()
} );

export const gameIdInputSchema = object( {
	gameId: ulid()
} );
