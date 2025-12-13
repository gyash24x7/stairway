import { implement, ORPCError, type RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type { RequestHeadersPluginContext, ResponseHeadersPluginContext } from "@orpc/server/plugins";
import { RequestHeadersPlugin, ResponseHeadersPlugin, SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import type { Session } from "@s2h/auth/types";
import type { SessionService } from "./sessions.ts";

export type Ctx = RequestHeadersPluginContext & ResponseHeadersPluginContext & {
	session?: Session;
	services: {
		session: SessionService;
	}
}

const os = implement( {} ).$context<Ctx>();

export function withAuth() {
	return os.use( ( { context, next } ) => {
		if ( !context.session?.authInfo ) {
			throw new ORPCError( "UNAUTHORIZED" );
		}
		return next( { context: { session: context.session } } );
	} );
}

const router = os.router( {} );

export const handler = new RPCHandler( router, {
	plugins: [
		new SimpleCsrfProtectionHandlerPlugin(),
		new ResponseHeadersPlugin(),
		new RequestHeadersPlugin()
	]
} );

export type ApiClient = RouterClient<typeof router>