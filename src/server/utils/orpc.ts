import { getAuthInfo } from "@/server/utils/auth";
import { createLogger } from "@/server/utils/logger";
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