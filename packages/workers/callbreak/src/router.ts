import { sValidator as validator } from "@hono/standard-validator";
import { CARD_IDS, CARD_SUITS } from "@s2h/utils/cards";
import { createLogger } from "@s2h/utils/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { length, ltValue, number, object, optional, picklist, pipe, string, trim, ulid } from "valibot";
import type { HonoCtx, HonoEnv } from "./types.ts";

const logger = createLogger( "Callbreak:Router" );
const app = new Hono<HonoEnv>();

async function loadEngine( gameId: string, ctx: HonoCtx ) {
	const key = await ctx.env.CALLBREAK_KV.get( `gameId:${ gameId }` );
	if ( !key ) {
		logger.error( "No Durable Object ID found for gameId:", gameId );
		throw new HTTPException( 404, { message: "Game not found." } );
	}

	const durableObjectId = ctx.env.CALLBREAK_DO.idFromString( key );
	return ctx.env.CALLBREAK_DO.get( durableObjectId );
}

app.use( async ( ctx, next ) => {
	logger.debug( `>> ${ ctx.req.method } ${ ctx.req.url }` );
	await next();
	logger.debug( `<< ${ ctx.req.method } ${ ctx.req.url }` );
} );

app.post(
	"/",
	validator( "json", object( {
		dealCount: optional( pipe( number(), picklist( [ 5, 9, 13 ] ) ) ),
		trumpSuit: picklist( Object.values( CARD_SUITS ) ),
		gameId: optional( pipe( string(), ulid() ) )
	} ) ),
	async ctx => {
		const durableObjectId = ctx.env.CALLBREAK_DO.newUniqueId();
		const engine = ctx.env.CALLBREAK_DO.get( durableObjectId );
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

app.post(
	"/join",
	validator( "json", object( { code: pipe( string(), trim(), length( 6 ) ) } ) ),
	async ctx => {
		const key = await ctx.env.CALLBREAK_KV.get( `code:${ ctx.req.valid( "json" ).code }` );
		if ( !key ) {
			logger.error( "No game found for code:", ctx.req.valid( "json" ).code );
			throw new HTTPException( 404, { message: "Game not found." } );
		}

		const durableObjectId = ctx.env.CALLBREAK_DO.idFromString( key );
		const engine = ctx.env.CALLBREAK_DO.get( durableObjectId );
		const { data: gameId, error } = await engine.addPlayer( ctx.var.authInfo );

		if ( error ) {
			logger.error( "Error joining game:", error );
			throw new HTTPException( 400, { message: "Failed to join game." } );
		}

		return ctx.json( { gameId } );
	}
);

app.put(
	"/:gameId/add-bots",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { error } = await engine.addBots( ctx.var.authInfo );

		if ( error ) {
			logger.error( "Error adding bots:", error );
			throw new HTTPException( 400, { message: "Failed to add bots." } );
		}

		return ctx.body( null, { status: 204 } );
	}
);

app.put(
	"/:gameId/declare-deal-wins",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	validator( "json", object( {
		wins: pipe( number(), ltValue( 13 ) ),
		dealId: pipe( string(), ulid() )
	} ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { error } = await engine.declareDealWins( ctx.req.valid( "json" ), ctx.var.authInfo );

		if ( error ) {
			logger.error( "Error declaring deal wins:", error );
			throw new HTTPException( 400, { message: "Failed to declare deal wins." } );
		}

		return ctx.body( null, { status: 204 } );
	}
);

app.put(
	"/:gameId/play-card",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	validator( "json", object( {
		cardId: picklist( CARD_IDS ),
		roundId: pipe( string(), ulid() ),
		dealId: pipe( string(), ulid() )
	} ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { error } = await engine.playCard( ctx.req.valid( "json" ), ctx.var.authInfo );

		if ( error ) {
			logger.error( "Error playing card:", error );
			throw new HTTPException( 400, { message: "Failed to play card." } );
		}

		return ctx.body( null, { status: 204 } );
	}
);

export const callbreak = app;