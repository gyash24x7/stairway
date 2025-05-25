import { getAuthInfo } from "@/auth/server/functions";
import { createLogger } from "@/shared/utils/logger";
import { ORPCError, os } from "@orpc/server";

const logger = createLogger( "ORPC" );

export const authMiddleware = os.middleware( async ( { next } ) => {
	const authInfo = await getAuthInfo();

	if ( !authInfo ) {
		logger.error( "User not logged in!" );
		throw new ORPCError( "UNAUTHORIZED" );
	}

	return next( { context: { authInfo } } );
} );