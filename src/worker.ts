import { validateSession } from "@/auth/worker/sessions";
import { handler } from "@/shared/utils/orpc";
import { setupPrisma } from "@/shared/utils/prisma";

export { CallbreakDO } from "@/callbreak/worker/durable.object";
export { FishDO } from "@/fish/worker/durable.object";
export { WebsocketDO } from "@/shared/utils/ws";

export default {
	async fetch( request, env ) {
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
			const durableObjectId = env.WS_DO.idFromName( `${ game }:${ gameId }` );
			const stub = env.WS_DO.get( durableObjectId );
			return stub.fetch( request );
		}

		if ( url.pathname.startsWith( "/api" ) ) {
			await setupPrisma( env );
			const session = await validateSession( request.headers );
			const result = await handler.handle( request, { context: { session }, prefix: "/api" } );
			if ( result.matched ) {
				return result.response;
			}
		}

		return new Response( null, { status: 404 } );
	}
} satisfies ExportedHandler<Env>;
