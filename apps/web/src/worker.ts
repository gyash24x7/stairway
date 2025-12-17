import { handler as authHandler } from "@s2h/auth/router";
import { validateSession } from "@s2h/auth/sessions";
import { handler as callbreakHandler } from "@s2h/callbreak/router";
import { handler as fishHandler } from "@s2h/fish/router";
import { handler as wordleHandler } from "@s2h/wordle/router";

export { CallbreakEngine } from "@s2h/callbreak/engine";
export { FishEngine } from "@s2h/fish/engine";
export { WordleEngine } from "@s2h/wordle/engine";
export { WebsocketServer } from "./wss.ts";

export default {
	async fetch( request: Request, env: Env ): Promise<Response> {
		const url = new URL( request.url );


		if ( url.pathname.startsWith( "/ws" ) ) {
			const upgradeHeader = request.headers.get( "Upgrade" );
			if ( !upgradeHeader || upgradeHeader !== "websocket" ) {
				return new Response( "Worker expected Upgrade: websocket", { status: 426 } );
			}

			if ( request.method !== "GET" ) {
				return new Response( "Worker expected GET method", { status: 400 } );
			}

			const [ _, _ws, game, gameId ] = url.pathname.split( "/" );
			const durableObjectId = env.WSS.idFromName( `${ game }:${ gameId }` );
			const stub = env.WSS.get( durableObjectId );
			return stub.fetch( request );
		}

		if ( url.pathname.startsWith( "/api/auth" ) ) {
			const result = await authHandler.handle( request, { context: { env }, prefix: "/api/auth" } );

			if ( result.matched ) {
				return result.response;
			}

			return Response.json( { error: "Not found" }, { status: 404 } );
		}

		if ( url.pathname.startsWith( "/api/callbreak" ) ) {
			const session = await validateSession( env, request.headers );
			if ( !session ) {
				return Response.json( { error: "Unauthorized" }, { status: 401 } );
			}

			const result = await callbreakHandler.handle( request, {
				context: { env, authInfo: session.authInfo },
				prefix: "/api/callbreak"
			} );

			if ( result.matched ) {
				return result.response;
			}
			return Response.json( { error: "Not found" }, { status: 404 } );
		}

		if ( url.pathname.startsWith( "/api/fish" ) ) {
			const session = await validateSession( env, request.headers );
			if ( !session ) {
				return Response.json( { error: "Unauthorized" }, { status: 401 } );
			}

			const result = await fishHandler.handle( request, {
				context: { env, authInfo: session.authInfo },
				prefix: "/api/fish"
			} );

			if ( result.matched ) {
				return result.response;
			}
			return Response.json( { error: "Not found" }, { status: 404 } );
		}

		if ( url.pathname.startsWith( "/api/wordle" ) ) {
			const session = await validateSession( env, request.headers );
			if ( !session ) {
				return Response.json( { error: "Unauthorized" }, { status: 401 } );
			}

			const result = await wordleHandler.handle( request, {
				context: { env, authInfo: session.authInfo },
				prefix: "/api/wordle"
			} );

			if ( result.matched ) {
				return result.response;
			}
			return Response.json( { error: "Not found" }, { status: 404 } );
		}

		return new Response( null, { status: 404 } );
	}
};