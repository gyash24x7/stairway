import { auth } from "@auth/api";
import type { Auth } from "@stairway/types/auth";
import { createLogger } from "@stairway/utils";
import type { AnyTRPCRouter } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createError, defineEventHandler, toWebRequest } from "h3";

const logger = createLogger( "Handlers" );

export const healthHandler = () => defineEventHandler( () => {
	logger.debug( ">> health()" );
	return { healthy: true };
} );

export const authHandler = () => defineEventHandler( ( event ) => {
	return auth.handler( toWebRequest( event ) );
} );

export const trpcHandler = <T extends AnyTRPCRouter>( endpoint: string, router: T ) => {
	return defineEventHandler( async ( event ) => {
		const session = await auth.api.getSession( { headers: event.headers } );
		if ( !session || !session.user ) {
			logger.error( "Unauthorized!" );
			throw createError( { status: 401, message: "Unauthorized!" } );
		}

		const authInfo: Auth.Info = {
			id: session.user.id,
			name: session.user.name,
			email: session.user.email,
			avatar: session.user.image ?? ""
		};

		const req = toWebRequest( event );
		return fetchRequestHandler( { router, endpoint, req, createContext: async () => ( { authInfo } ) } );
	} );
};