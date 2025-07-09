import { getPasskey, getUserByUsername, getUserPasskeys } from "@/auth/server/repository";
import type { Passkey, User, WebAuthnOptions } from "@/auth/types";
import { createLogger } from "@/shared/utils/logger";
import { env } from "cloudflare:workers";

const logger = createLogger( "Auth:Validators" );

/**
 * Validates WebAuthn options for a given username.
 * This function retrieves the WebAuthn options from the KV store
 * and parses them.
 * If the options are not found, it throws an error.
 *
 * @param {string} username - The username for which to validate WebAuthn options.
 * @returns {Promise<WebAuthnOptions>} WebAuthn options for the user.
 */
export async function validateWebAuthnOptions( username: string ): Promise<WebAuthnOptions> {
	return env.WEBAUTHN_KV.get( username ).then( options => {
		if ( !options ) {
			logger.error( "No WebAuthn options found for username:", username );
			throw "No WebAuthn options found";
		}
		return JSON.parse( options ) as WebAuthnOptions;
	} );
}

/**
 * Validates if a user exists by checking their username.
 * If the user does not exist, it throws an error.
 *
 * @param {string} username - The username to validate.
 * @returns {Promise<User>} The existing user object.
 */
export async function validateUserExists( username: string ): Promise<User> {
	return getUserByUsername( username ).then( existingUser => {
		if ( !existingUser ) {
			logger.error( "User not found:", username );
			throw "User not found";
		}
		return existingUser;
	} );
}

/**
 * Validates if a passkey exists for a given user.
 * If the passkey does not exist, it throws an error.
 *
 * @param {string} passkeyId - The ID of the passkey to validate.
 * @param {string} userId - The ID of the user to check against.
 * @returns {Promise<Passkey>} The existing passkey object.
 */
export async function validatePasskeyExists( passkeyId: string, userId: string ): Promise<Passkey> {
	return getPasskey( passkeyId, userId ).then( passkey => {
		if ( !passkey ) {
			logger.error( "Passkey not found for user:", userId, "with ID:", passkeyId );
			throw "Passkey not found";
		}
		return passkey;
	} );
}

/**
 * Validates that a user has at least one passkey.
 * If no passkeys are found, it throws an error.
 *
 * @param {string} userId - The ID of the user to check.
 * @returns {Promise<Passkey[]>} An array of passkeys for the user.
 */
export async function validatePasskeys( userId: string ): Promise<Passkey[]> {
	return getUserPasskeys( userId ).then( passkeys => {
		if ( passkeys.length === 0 ) {
			logger.error( "No passkeys found for user:", userId );
			throw "No passkeys found";
		}
		return passkeys;
	} );
}
