import { router } from "@/api/routers";
import { loadSession } from "@s2h/auth";
import { db } from "@s2h/db";
import { games } from "@s2h/db/schema";
import { RPCHandler } from "@orpc/server/fetch";
import { env } from "cloudflare:workers";
import { and, eq, inArray, lt } from "drizzle-orm";

const handler = new RPCHandler( router );

/** Applies the app's baseline security headers to a response. */
function withCommonHeaders( response: Response ): Response {
	const res = new Response( response.body, response );
	res.headers.set( "X-Content-Type-Options", "nosniff" );
	res.headers.set( "Referrer-Policy", "no-referrer" );
	res.headers.set( "Permissions-Policy", "geolocation=(), microphone=(), camera=()" );
	return res;
}

export default {
	async fetch( req: Request, env: Env, ctx: ExecutionContext ): Promise<Response> {
		const url = new URL( req.url );

		if ( url.pathname.startsWith( "/api" ) ) {
			const user = await loadSession( req.headers.get( "Cookie" ) ?? "" );
			const resHeaders = new Headers();

			const { matched, response } = await handler.handle( req, {
				prefix: "/api",
				context: { env, req, ctx, user, resHeaders }
			} );

			if ( matched ) {
				// Merge cookies/headers emitted by procedures (e.g. Set-Cookie) onto the response.
				const merged = new Response( response.body, response );
				resHeaders.forEach( ( value, key ) => merged.headers.append( key, value ) );
				return withCommonHeaders( merged );
			}

			return withCommonHeaders( new Response( "Not Found", { status: 404 } ) );
		}

		// Everything else is served by static assets (SPA fallback handled by Cloudflare).
		return withCommonHeaders( await env.ASSETS.fetch( req ) );
	},

	async scheduled() {
		const twoDaysAgo = Date.now() / 1000 - 2 * 24 * 60 * 60;

		const staleGames = await db
			.select()
			.from( games )
			.where( and( eq( games.completed, 0 ), lt( games.createdAt, twoDaysAgo ) ) );

		for ( const game of staleGames ) {
			const stub = getGameStub( game.game, game.id );
			if ( stub ) {
				await stub.cleanup();
			}
		}

		if ( staleGames.length > 0 ) {
			const staleIds = staleGames.map( g => g.id );
			await db.delete( games ).where( inArray( games.id, staleIds ) );
		}
	}
} satisfies ExportedHandler<Env>;

/** Resolves the engine Durable Object stub for a stored game name + id. */
function getGameStub( game: string, gameId: string ) {
	const name = `${ game }:${ gameId }`;
	switch ( game ) {
		case "wordle":
			return env.WORDLE_ENGINE.get( env.WORDLE_ENGINE.idFromName( name ) );
		case "tic-tac-toe":
			return env.TIC_TAC_TOE_ENGINE.get( env.TIC_TAC_TOE_ENGINE.idFromName( name ) );
		case "splendor":
			return env.SPLENDOR_ENGINE.get( env.SPLENDOR_ENGINE.idFromName( name ) );
		case "kingdomino":
			return env.KINGDOMINO_ENGINE.get( env.KINGDOMINO_ENGINE.idFromName( name ) );
		case "fish":
			return env.FISH_ENGINE.get( env.FISH_ENGINE.idFromName( name ) );
		case "callbreak":
			return env.CALLBREAK_ENGINE.get( env.CALLBREAK_ENGINE.idFromName( name ) );
	}

	return null;
}

// Engine Durable Objects must be re-exported from the Worker entry (Cloudflare requirement).
export { WordleEngine } from "@s2h/wordle-core/engine";
export { TicTacToeEngine } from "@s2h/tictactoe-core/engine";
export { SplendorEngine } from "@s2h/splendor-core/engine";
export { FishEngine } from "@s2h/fish-core/engine";
export { CallbreakEngine } from "@s2h/callbreak-core/engine";
export { KingdominoEngine } from "@s2h/kingdomino-core/engine";
