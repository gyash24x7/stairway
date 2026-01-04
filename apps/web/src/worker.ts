import { handler as authHandler } from "@s2h/auth/router";
import { validateSession } from "@s2h/auth/sessions";
import { handler as callbreakHandler } from "@s2h/callbreak/router";
import { handler as fishHandler } from "@s2h/fish/router";
import { handler as splendorHandler } from "@s2h/splendor/router";
import { handler as wordleHandler } from "@s2h/wordle/router";
import { WorkerEntrypoint } from "cloudflare:workers";

export { CallbreakEngine } from "@s2h/callbreak/engine";
export { FishEngine } from "@s2h/fish/engine";
export { SplendorEngine } from "@s2h/splendor/engine";
export { WordleEngine } from "@s2h/wordle/engine";
export { WebsocketServer } from "./wss.ts";

export default class StairwayWorker extends WorkerEntrypoint {
	override async fetch( request: Request ): Promise<Response> {
		const url = new URL( request.url );

		if ( url.pathname.startsWith( "/ws" ) ) {
			return this.handleWebsocketRequest( request );
		}

		if ( url.pathname.startsWith( "/api/auth" ) ) {
			return this.handleOrpcRequest( request, "/api/auth", authHandler );
		}

		if ( url.pathname.startsWith( "/api/callbreak" ) ) {
			return this.handleOrpcRequest( request, "/api/callbreak", callbreakHandler, true );
		}

		if ( url.pathname.startsWith( "/api/fish" ) ) {
			return this.handleOrpcRequest( request, "/api/fish", fishHandler, true );
		}

		if ( url.pathname.startsWith( "/api/splendor" ) ) {
			return this.handleOrpcRequest( request, "/api/splendor", splendorHandler, true );
		}

		if ( url.pathname.startsWith( "/api/wordle" ) ) {
			return this.handleOrpcRequest( request, "/api/wordle", wordleHandler, true );
		}

		return new Response( null, { status: 404 } );
	}

	private async handleWebsocketRequest( request: Request ) {
		const url = new URL( request.url );
		const upgradeHeader = request.headers.get( "Upgrade" );
		if ( !upgradeHeader || upgradeHeader !== "websocket" ) {
			return new Response( "Worker expected Upgrade: websocket", { status: 426 } );
		}

		if ( request.method !== "GET" ) {
			return new Response( "Worker expected GET method", { status: 400 } );
		}

		const [ _, _ws, game, gameId ] = url.pathname.split( "/" );
		const durableObjectId = this.env.WSS.idFromName( `${ game }:${ gameId }` );
		const stub = this.env.WSS.get( durableObjectId );
		return stub.fetch( request );
	}

	private async handleOrpcRequest( request: Request, prefix: string, handler: any, requireAuth = false ) {
		if ( !requireAuth ) {
			const result = await handler.handle( request, { context: { env: this.env }, prefix } );
			if ( result.matched ) {
				return result.response;
			}

			return Response.json( { error: "Not found" }, { status: 404 } );
		}

		const session = await validateSession( this.env, request.headers );
		if ( !session ) {
			return Response.json( { error: "Unauthorized" }, { status: 401 } );
		}

		const result = await handler.handle(
			request,
			{ context: { env: this.env, authInfo: session.authInfo }, prefix }
		);
		if ( result.matched ) {
			return result.response;
		}

		return Response.json( { error: "Not found" }, { status: 404 } );
	}
}
