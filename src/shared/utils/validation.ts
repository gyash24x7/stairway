import { minLength, object, pipe, string, trim, ulid as ulidBase } from "valibot";

export const ulid = () => pipe( string(), trim(), ulidBase() );

export const gameIdInput = object( { gameId: ulid() } );

export const username = () => pipe( string(), trim(), minLength( 3 ) );