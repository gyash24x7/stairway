import { sValidator as validator } from "@hono/standard-validator";
import { createLogger } from "@s2h/utils/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { nonEmpty, number, object, optional, picklist, pipe, string, ulid } from "valibot";
import type { HonoCtx, HonoEnv } from "./types.ts";

const logger = createLogger( "Wordle:Router" );
const app = new Hono<HonoEnv>();

async function loadEngine( gameId: string, ctx: HonoCtx ) {
	const id = await ctx.env.WORDLE_KV.get( `gameId:${ gameId }` );
	if ( !id ) {
		logger.error( "No Durable Object ID found for gameId:", gameId );
		throw new HTTPException( 404, { message: "Game not found." } );
	}

	const durableObjectId = ctx.env.WORDLE_DO.idFromString( id );
	return ctx.env.WORDLE_DO.get( durableObjectId );
}

app.use( async ( ctx, next ) => {
	logger.debug( `>> ${ ctx.req.method } ${ ctx.req.url }` );
	await next();
	logger.debug( `<< ${ ctx.req.method } ${ ctx.req.url }` );
} );

app.post(
	"/",
	validator( "json", object( {
		wordCount: optional( number() ),
		wordLength: optional( picklist( [ 4, 5, 6 ] ) )
	} ) ),
	async ctx => {
		const durableObjectId = ctx.env.WORDLE_DO.newUniqueId();
		const engine = ctx.env.WORDLE_DO.get( durableObjectId );
		const { data: gameId } = await engine.initialize( ctx.req.valid( "json" ), ctx.var.authInfo.id );
		return ctx.json( { gameId } );
	}
);

app.get(
	"/:gameId",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { data, error } = await engine.getPlayerData( ctx.var.authInfo.id );

		if ( error ) {
			logger.error( "Error fetching player data:", error );
			throw new HTTPException( 400, { message: "Failed to fetch player data." } );
		}

		return ctx.json( data );
	}
);

app.get(
	"/:gameId/words",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { data: words, error } = await engine.getWords( ctx.var.authInfo.id );

		if ( error ) {
			logger.error( "Error fetching words:", error );
			throw new HTTPException( 400, { message: "Failed to fetch words." } );
		}

		return ctx.json( { words } );
	}
);

app.put(
	"/:gameId/guess",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	validator( "json", object( { guess: pipe( string(), nonEmpty() ) } ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { data, error } = await engine.makeGuess( ctx.req.valid( "json" ), ctx.var.authInfo.id );

		if ( error ) {
			logger.error( "Error making guess:", error );
			throw new HTTPException( 400, { message: "Failed to make guess." } );
		}

		return ctx.json( data );
	}
);

export const wordle = app;