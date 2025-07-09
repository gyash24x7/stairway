import { CARD_IDS } from "@/libs/cards/constants";
import { minLength, object, picklist, pipe, string, trim, ulid as ulidBase } from "valibot";

export const ulid = () => pipe( string(), trim(), ulidBase() );

export const gameIdInput = object( { gameId: ulid() } );

export const username = () => pipe( string(), trim(), minLength( 3 ) );

export const cardId = () => pipe( string(), trim(), picklist( CARD_IDS ) );