import { CARD_IDS, CARD_SUITS } from "@/libs/cards/constants";
import * as v from "valibot";

const ulid = () => v.pipe( v.string(), v.trim(), v.ulid() );
const cardId = () => v.pipe( v.string(), v.trim(), v.picklist( CARD_IDS ) );

export const createGameInputSchema = v.object( {
	dealCount: v.optional( v.pipe( v.number(), v.picklist( [ 5, 9, 13 ] ) ) ),
	trumpSuit: v.picklist( Object.values( CARD_SUITS ) )
} );

export const joinGameInputSchema = v.object( {
	code: v.pipe( v.string(), v.trim(), v.length( 6 ) )
} );


export const declareDealWinsInputSchema = v.object( {
	wins: v.pipe( v.number(), v.ltValue( 13 ) ),
	dealId: ulid(),
	gameId: ulid()
} );

export const playCardInputSchema = v.object( {
	cardId: cardId(),
	roundId: ulid(),
	dealId: ulid(),
	gameId: ulid()
} );

export const gameIdInputSchema = v.object( {
	gameId: ulid()
} );
