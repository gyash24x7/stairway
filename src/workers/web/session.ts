import { constantTimeEqual } from "@/utils/fns";
import { generateSecureRandomString } from "@/utils/generator";
import { createLogger } from "@/utils/logger";
import { customSchema } from "@/utils/schema";
import { type AuthInfo, authInfoSchema } from "@/workers/auth/schema";
import { type InferInput, number, object, string } from "valibot";

const logger = createLogger( "Web:Session" );

export type Session = InferInput<typeof sessionSchema>;
export const sessionSchema = object( {
	id: string(),
	token: string(),
	hash: customSchema<Uint8Array>(),
	authInfo: authInfoSchema,
	createdAt: number()
} );

export async function createSession( authInfo: AuthInfo ) {
	const sessionId = generateSecureRandomString();
	const sessionSecret = generateSecureRandomString();
	const hash = await hashSecret( sessionSecret );
	const token = sessionId + "." + sessionSecret;
	return { id: sessionId, token, hash, authInfo, createdAt: Date.now() };
}

export async function validateSessionToken(
	getToken: () => Promise<string | undefined>,
	getSession: ( sessionId: string ) => Promise<Session | null | undefined>,
	deleteSession: ( sessionId: string ) => Promise<void>
) {
	const token = await getToken();
	if ( !token ) {
		logger.warn( "No Session Token!" );
		return undefined;
	}

	const tokenParts = token.split( "." );
	if ( tokenParts.length !== 2 ) {
		logger.warn( "Malformed Token!" );
		return undefined;
	}
	const sessionId = tokenParts[ 0 ];
	const sessionSecret = tokenParts[ 1 ];

	const session = await getSession( sessionId );
	if ( !session ) {
		logger.warn( "No Session Found!" );
		return undefined;
	}

	const tokenSecretHash = await hashSecret( sessionSecret );
	const validSecret = constantTimeEqual( tokenSecretHash, session.hash );
	if ( !validSecret ) {
		logger.warn( "Invalid Session!" );
		return undefined;
	}

	if ( Date.now() - session.createdAt >= 7 * 24 * 60 * 60 * 1000 ) {
		logger.warn( "Session Expired!" );
		await deleteSession( session.id );
		return undefined;
	}

	return session;
}

async function hashSecret( secret: string ): Promise<Uint8Array> {
	const secretBytes = new TextEncoder().encode( secret );
	const secretHashBuffer = await crypto.subtle.digest( "SHA-256", secretBytes );
	return new Uint8Array( secretHashBuffer );
}