import { router as auth } from "@/auth/worker/router";
import { router as callbreak } from "@/callbreak/worker/router";
import { router as fish } from "@/fish/worker/router";
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
export const router = { auth, callbreak, fish, wordle };

export const handler = new RPCHandler( router, {
	plugins: [
		new SimpleCsrfProtectionHandlerPlugin(),
		new ResponseHeadersPlugin()
	]
} );