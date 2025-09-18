import { router as auth } from "@/auth/worker/router";
import { validateSession } from "@/auth/worker/sessions";
import { router as callbreak } from "@/callbreak/worker/router";
import { router as fish } from "@/fish/worker/router";
import { setupPrisma } from "@/shared/utils/prisma";
import { router as wordle } from "@/wordle/worker/router";
import { ORPCError, os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ResponseHeadersPlugin, SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";

export const requireAuth = os.$context<Ctx>().middleware( ( { context, next } ) => {
	if ( !context.session ) {
		throw new ORPCError( "FORBIDDEN" );
	}

	return next( { context: { session: context.session } } );
} );

export type ORPCRouter = typeof router;
const router = { auth, callbreak, fish, wordle };
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