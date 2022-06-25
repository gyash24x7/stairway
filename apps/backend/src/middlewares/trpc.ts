import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { TrpcContext } from "@s2h/utils";

function handleTrpc<T extends TrpcContext>( router: any, context: T ) {
	return createExpressMiddleware( {
		router,
		createContext: ( { res } ): T => ( { ...context, loggedInUser: res.locals.user } )
	} );
}

export default handleTrpc;