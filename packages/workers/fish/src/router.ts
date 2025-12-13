import { sValidator as validator } from "@hono/standard-validator";
import { CARD_IDS } from "@s2h/utils/cards";
import { createLogger } from "@s2h/utils/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { array, length, object, picklist, pipe, record, string, trim, ulid } from "valibot";
import type { HonoCtx, HonoEnv } from "./types.ts";

const logger = createLogger( "Fish:Router" );
const app = new Hono<HonoEnv>();

async function loadEngine( gameId: string, ctx: HonoCtx ) {
	const key = await ctx.env.FISH_KV.get( `gameId:${ gameId }` );
	if ( !key ) {
		logger.error( "No Durable Object ID found for gameId:", gameId );
		throw new HTTPException( 404, { message: "Game not found." } );
	}

	const durableObjectId = ctx.env.FISH_DO.idFromString( key );
	return ctx.env.FISH_DO.get( durableObjectId );
}

app.use( async ( ctx, next ) => {
	logger.debug( `>> ${ ctx.req.method } ${ ctx.req.url }` );
	await next();
	logger.debug( `<< ${ ctx.req.method } ${ ctx.req.url }` );
} );

app.post(
	"/",
	validator( "json", object( {
		playerCount: picklist( [ 3, 4, 6, 8 ] ),
		type: picklist( [ "NORMAL", "CANADIAN" ] as const ),
		teamCount: picklist( [ 2, 3, 4 ] )
	} ) ),
	async ctx => {
		const durableObjectId = ctx.env.FISH_DO.newUniqueId();
		const engine = ctx.env.FISH_DO.get( durableObjectId );
		const { data: gameId, error } = await engine.initialize( ctx.req.valid( "json" ), ctx.var.authInfo );

		if ( error ) {
			logger.error( "Error creating game:", error );
			throw new HTTPException( 400, { message: "Failed to create game." } );
		}

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
		const key = await ctx.env.FISH_KV.get( `code:${ ctx.req.valid( "json" ).code }` );
		if ( !key ) {
			logger.error( "No game found for code:", ctx.req.valid( "json" ).code );
			throw new HTTPException( 404, { message: "Game not found." } );
		}

		const durableObjectId = ctx.env.FISH_DO.idFromString( key );
		const engine = ctx.env.FISH_DO.get( durableObjectId );
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
	"/:gameId/create-teams",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	validator( "json", record( string(), array( pipe( string(), ulid() ) ) ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { error } = await engine.createTeams( ctx.req.valid( "json" ), ctx.var.authInfo );

		if ( error ) {
			logger.error( "Error creating teams:", error );
			throw new HTTPException( 400, { message: "Failed to create teams." } );
		}

		return ctx.body( null, { status: 204 } );
	}
);


app.put(
	"/:gameId/start-game",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { error } = await engine.startGame( ctx.var.authInfo );

		if ( error ) {
			logger.error( "Error starting game:", error );
			throw new HTTPException( 400, { message: "Failed to start game." } );
		}

		return ctx.body( null, { status: 204 } );
	}
);

app.put(
	"/:gameId/ask-card",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	validator( "json", object( {
		from: pipe( string(), ulid() ),
		cardId: picklist( CARD_IDS )
	} ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { error } = await engine.askCard( ctx.req.valid( "json" ), ctx.var.authInfo );

		if ( error ) {
			logger.error( "Error aking card:", error );
			throw new HTTPException( 400, { message: "Failed to ask card" } );
		}

		return ctx.body( null, { status: 204 } );
	}
);

app.put(
	"/:gameId/claim-book",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	validator( "json", record( picklist( CARD_IDS ), pipe( string(), ulid() ) ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { error } = await engine.claimBook( ctx.req.valid( "json" ), ctx.var.authInfo );

		if ( error ) {
			logger.error( "Error claiming book:", error );
			throw new HTTPException( 400, { message: "Failed to claim book." } );
		}

		return ctx.body( null, { status: 204 } );
	}
);

app.put(
	"/:gameId/transfer-turn",
	validator( "param", object( { gameId: pipe( string(), ulid() ) } ) ),
	validator( "json", object( { transferTo: pipe( string(), ulid() ) } ) ),
	async ctx => {
		const engine = await loadEngine( ctx.req.valid( "param" ).gameId, ctx );
		const { error } = await engine.transferTurn( ctx.req.valid( "json" ), ctx.var.authInfo );

		if ( error ) {
			logger.error( "Error transferring turn:", error );
			throw new HTTPException( 400, { message: "Failed to transfer turn." } );
		}

		return ctx.body( null, { status: 204 } );
	}
);

export const fish = app;