import { generateSecureRandomString } from "@/utils/generator";
import { createLogger } from "@/utils/logger";
import type { AuthInfo } from "@/workers/auth/types";

const logger = createLogger( "Web:Session" );

export type Session = {
	id: string;
	authInfo: AuthInfo;
	createdAt: number;
}

export async function createSession( authInfo: AuthInfo ) {
	const sessionId = generateSecureRandomString();
	return { id: sessionId, authInfo, createdAt: Date.now() };
}

export async function validateSessionToken(
	getSessionId: () => Promise<string | undefined>,
	getSession: ( sessionId: string ) => Promise<Session | null | undefined>,
	deleteSession: ( sessionId: string ) => Promise<void>
) {
	const sessionId = await getSessionId();
	if ( !sessionId ) {
		logger.warn( "No Session Id!" );
		return undefined;
	}

	const session = await getSession( sessionId );
	if ( !session ) {
		logger.warn( "No Session Found!" );
		return undefined;
	}

	if ( Date.now() - session.createdAt >= 7 * 24 * 60 * 60 * 1000 ) {
		logger.warn( "Session Expired!" );
		await deleteSession( session.id );
		return undefined;
	}

	return session;
}
