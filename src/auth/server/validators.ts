import * as repository from "@/auth/server/repository";
import type { WebAuthnOptions } from "@/auth/types";
import { createLogger } from "@/shared/utils/logger";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ORPCError } from "@orpc/server";

const logger = createLogger( "Auth:Validators" );

export async function validateWebAuthnOptions( username: string ) {
	const ctx = await getCloudflareContext( { async: true } );
	const options = await ctx.env.WEBAUTHN_KV.get( username );
	if ( !options ) {
		logger.error( "No WebAuthn options found for username:", username );
		throw new ORPCError( "NOT_FOUND", { message: "No WebAuthn options found" } );
	}

	return JSON.parse( options ) as WebAuthnOptions;
}

export async function validateUserExists( username: string ) {
	const existingUser = await repository.getUserByUsername( username );
	if ( !existingUser ) {
		logger.error( "User not found:", username );
		throw new ORPCError( "NOT_FOUND", { message: "User not found" } );
	}
	return existingUser;
}

export async function validatePasskeyExists( passkeyId: string, userId: string ) {
	const passkey = await repository.getPasskey( passkeyId, userId );
	if ( !passkey ) {
		logger.error( "Passkey not found for user:", userId );
		throw new ORPCError( "NOT_FOUND", { message: "Passkey not found" } );
	}
	return passkey;
}

export async function validatePasskeys( userId: string ) {
	const passkeys = await repository.getUserPasskeys( userId );
	if ( !passkeys || passkeys.length === 0 ) {
		logger.error( "No passkeys found for user:", userId );
		throw new ORPCError( "NOT_FOUND", { message: "No passkeys found" } );
	}
	return passkeys;
}
