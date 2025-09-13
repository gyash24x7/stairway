import { router } from "@/workers/web/router";
import { validateSessionToken } from "@/workers/web/session";
import { RPCHandler } from "@orpc/server/fetch";
import { getCookie, unsign } from "@orpc/server/helpers";
import { ResponseHeadersPlugin, SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";

const handler = new RPCHandler( router, {
	plugins: [
		new SimpleCsrfProtectionHandlerPlugin(),
		new ResponseHeadersPlugin()
	]
} );

export default {
	async fetch( request, env ) {
		const url = new URL( request.url );

		if ( url.pathname.startsWith( "/api" ) ) {

			const session = await validateSessionToken(
				() => unsign( getCookie( request.headers, "auth_session" ), env.AUTH_SECRET_KEY ),
				( sessionId ) => env.SESSION_KV.get( sessionId, "json" ),
				( sessionId ) => env.SESSION_KV.delete( sessionId )
			);

			const result = await handler.handle( request, { context: { env, session }, prefix: "/api" } );
			if ( result.matched ) {
				return result.response;
			}
		}

		return new Response( null, { status: 404 } );
	}
} satisfies ExportedHandler<WebWorkerEnv>;
  