import type { PlayerGameInfo } from "@/wordle/types";
import { service } from "@/wordle/worker/service";
import { requireAuth } from "@/worker";
import { os } from "@orpc/server";
import { array, custom, gtValue, length, number, object, optional, picklist, pipe, string, ulid } from "valibot";

const createGame = os.$context<Ctx>().use( requireAuth )
	.input( object( {
		wordCount: optional( pipe( number(), gtValue( 0 ) ) ),
		wordLength: optional( pipe( number(), picklist( [ 5 ] ) ) ),
		gameId: optional( pipe( string(), ulid() ) )
	} ) )
	.output( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( ( { input, context } ) => service.createGame( input, context.session.authInfo ) );

const getGameData = os.$context<Ctx>().use( requireAuth )
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.output( custom<PlayerGameInfo>( () => true ) )
	.handler( ( { input, context } ) => service.getGameData( input, context.session.authInfo ) );

const makeGuess = os.$context<Ctx>().use( requireAuth )
	.input( object( {
		gameId: pipe( string(), ulid() ),
		guess: pipe( string(), length( 5 ) )
	} ) )
	.output( custom<PlayerGameInfo>( () => true ) )
	.handler( ( { input, context } ) => service.makeGuess( input, context.session.authInfo ) );

const getWords = os.$context<Ctx>().use( requireAuth )
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.output( array( string() ) )
	.handler( ( { input, context } ) => service.getWords( input, context.session.authInfo ) );

export const router = { createGame, getGameData, makeGuess, getWords };