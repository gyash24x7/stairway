import { handler } from "@s2h/api/router";
import { SessionService } from "@s2h/api/sessions";
import { FishService } from "@s2h/fish/service";

export { CallbreakEngine } from "@s2h/callbreak/engine";
export { FishEngine } from "@s2h/fish/engine";
export { WebsocketServer } from "@s2h/api/wss";

export default {
	async fetch( request: Request, env: Env ): Promise<Response> {
		const url = new URL( request.url );
		const services = {
			session: new SessionService( env.SESSION_KV, env.AUTH_SECRET_KEY ),
			fish: new FishService( env.FISH_DO, env.FISH_KV )
		};


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

		if ( url.pathname.startsWith( "/api" ) ) {
			const session = await services.session.validateSession( request.headers );
			const result = await handler.handle( request, { context: { session, services }, prefix: "/api" } );

			if ( result.matched ) {
				return result.response;
			}

			return Response.json( { error: "Not found" }, { status: 404 } );
		}

		return new Response( null, { status: 404 } );
	}
};