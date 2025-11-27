import { oc } from "@orpc/contract";
import type { PlayerGameInfo } from "@s2h/wordle/types";
import { custom, number, object, optional, pipe, string, trim } from "valibot";

export default {
	createGame: oc
		.input( object( { wordCount: optional( number() ), wordLength: optional( number() ) } ) )
		.output( custom<PlayerGameInfo>( () => true ) ),

	getGame: oc
		.input( pipe( string(), trim() ) )
		.output( custom<PlayerGameInfo | null>( () => true ) ),

	makeGuess: oc
		.input( object( { gameId: pipe( string(), trim() ), guess: pipe( string(), trim() ) } ) )
		.output( custom<PlayerGameInfo>( () => true ) ),

	getWords: oc
		.input( pipe( string(), trim() ) )
		.output( custom<string[]>( () => true ) )
};
