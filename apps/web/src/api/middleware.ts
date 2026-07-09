import { base } from "@/api/orpc";
import { ORPCError } from "@orpc/server";

/**
 * Middleware that requires an authenticated user.
 * Throws `UNAUTHORIZED` when no session user is present; otherwise narrows
 * `context.user` to a non-null `AuthInfo` for downstream handlers.
 */
export const requireAuth = base.middleware( async ( { context, next } ) => {
	if ( !context.user ) {
		throw new ORPCError( "UNAUTHORIZED" );
	}

	return next( { context: { user: context.user } } );
} );

/** Base procedure builder that requires authentication. */
export const authed = base.use( requireAuth );
