import { CARD_IDS } from "@/libs/cards/constants";
import type { CardId } from "@/libs/cards/types";
import { cardId, ulid } from "@/shared/utils/validation";
import { array, custom, length, number, object, optional, picklist, pipe, record, string, trim } from "valibot";

export const createGameInputSchema = object( {
	playerCount: optional( pipe( number(), picklist( [ 2, 4, 6, 8 ] ) ) )
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
	data: custom<Record<CardId, string>>( ( value ) => CARD_IDS.includes( value as CardId ) )
} );

export const askCardInputSchema = object( {
	gameId: ulid(),
	from: ulid(),
	card: cardId()
} );
