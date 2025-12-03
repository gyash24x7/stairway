import { generateAvatar, generateId } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";
import type {
	AuthInfo,
	LoginOptions,
	NameInput,
	RegistrationOptions,
	UsernameInput,
	VerifyLoginInput,
	VerifyRegistrationInput,
	WebauthnOptions
} from "./types.ts";

export class AuthService {

	private readonly logger = createLogger( "Auth:RPC" );
	private readonly db: DrizzleD1Database<typeof schema>;

	constructor(
		database: D1Database,
		private readonly rpId: string,
		private readonly rpOrigin: string,
		private readonly kv: KVNamespace
	) {
		this.db = drizzle( database, { schema } );
	}

	/**
	 * Check if a user exists by username
	 * @param username {string} - The username to check
	 * @returns {Promise<boolean>} True if the user exists, false otherwise
	 */
	async userExists( username: string ): Promise<boolean> {
		this.logger.debug( ">> userExists()" );
		const [ user ] = await this.db.select().from( schema.users ).where( eq( schema.users.username, username ) );
		this.logger.debug( "<< userExists()" );
		return !!user;
	}

	/**
	 * Get WebAuthn registration options for given name and username
	 * @param input {UsernameInput & NameInput} - The input containing username and name
	 * @returns {Promise<RegistrationOptions>} The WebAuthn registration options
	 */
	async getRegistrationOptions( input: UsernameInput & NameInput ): Promise<RegistrationOptions> {
		this.logger.debug( ">> getRegistrationOptions()" );

		const options = await generateRegistrationOptions( {
			userDisplayName: input.name,
			rpID: this.rpId,
			rpName: "stairway",
			userName: input.username,
			attestationType: "none",
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "preferred"
			}
		} );

		const webAuthnOptions = { challenge: options.challenge, webauthnUserId: options.user.id };
		await this.kv.put( input.username, JSON.stringify( webAuthnOptions ) );
		this.logger.info( "Stored WebAuthn options in KV for user:", input.username );

		this.logger.debug( "<< getRegistrationOptions()" );
		return options;
	}

	/**
	 * Get WebAuthn login options for given username
	 * @param input {UsernameInput} - The input containing username
	 * @returns {Promise<LoginOptions>} The WebAuthn login options
	 */
	async getLoginOptions( { username }: UsernameInput ): Promise<LoginOptions> {
		this.logger.debug( ">> getLoginOptions()" );

		const [ user ] = await this.db.select().from( schema.users ).where( eq( schema.users.username, username ) );
		if ( !user ) {
			this.logger.error( "User not found for username:", username );
			throw "User not found";
		}

		const options = await generateAuthenticationOptions( {
			rpID: this.rpId,
			userVerification: "preferred",
			allowCredentials: []
		} );

		const webAuthnOptions = { challenge: options.challenge };
		await this.kv.put( username, JSON.stringify( webAuthnOptions ) );
		this.logger.info( "Stored WebAuthn options in KV for user:", username );

		this.logger.debug( "<< getLoginOptions()" );
		return options;
	}

	/**
	 * Verify WebAuthn registration response
	 * @param input {VerifyRegistrationInput} - The input containing username, name, and response
	 * @returns {Promise<AuthInfo>} The created user
	 */
	async verifyRegistration( { username, name, response }: VerifyRegistrationInput ): Promise<AuthInfo> {
		this.logger.debug( ">> verifyRegistration()" );

		const options = await this.getWebAuthnOptions( username );
		const verification = await verifyRegistrationResponse( {
			response: response,
			expectedChallenge: options.challenge,
			expectedOrigin: this.rpOrigin,
			expectedRPID: this.rpId
		} )
			.catch( ( error: Error ) => {
				this.logger.error( "Error verifying registration response:", error.message );
				throw "Error verifying registration response";
			} );

		if ( !verification || !verification.verified || !verification.registrationInfo ) {
			this.logger.error( "WebAuthn verification failed for user:", username );
			throw "WebAuthn verification failed";
		}

		const [ user ] = await this.db.insert( schema.users )
			.values( { name, username, id: generateId(), avatar: generateAvatar() } )
			.returning();

		this.logger.info( "User created for WebAuthn registration:", user.id );

		await this.db.insert( schema.passkeys ).values( {
			id: verification.registrationInfo.credential.id,
			publicKey: verification.registrationInfo.credential.publicKey,
			userId: user.id,
			counter: verification.registrationInfo.credential.counter
		} );

		await this.kv.delete( username );
		this.logger.info( "Deleted WebAuthn options from KV for user:", username );

		this.logger.debug( "<< verifyRegistration()" );
		return user;
	}

	/**
	 * Verify WebAuthn login response
	 * @param input {VerifyLoginInput} - The input containing username and response
	 * @returns {Promise<AuthInfo>} The authenticated user
	 */
	async verifyLogin( { username, response }: VerifyLoginInput ): Promise<AuthInfo> {
		this.logger.debug( ">> verifyLogin()" );

		const options = await this.getWebAuthnOptions( username );

		const [ user ] = await this.db.select().from( schema.users ).where( eq( schema.users.username, username ) );
		if ( !user ) {
			this.logger.error( "User not found for username:", username );
			throw "User not found";
		}

		const [ passkey ] = await this.db.select()
			.from( schema.passkeys )
			.where( and( eq( schema.passkeys.id, response.id ), eq( schema.passkeys.userId, user.id ) ) );

		if ( !passkey ) {
			this.logger.error( "Passkey not found for user:", user.id, "with ID:", response.id );
			throw "Passkey not found for user";
		}

		this.logger.info( "Passkey exists for user:", user.id );

		const verification = await verifyAuthenticationResponse( {
			response,
			expectedChallenge: options.challenge,
			expectedOrigin: this.rpOrigin,
			expectedRPID: this.rpId,
			credential: {
				id: passkey.id,
				publicKey: passkey.publicKey,
				counter: passkey.counter
			}
		} );

		if ( !verification || !verification.verified || !verification.authenticationInfo ) {
			this.logger.error( "WebAuthn authentication verification failed for user:", user.username );
			throw "WebAuthn authentication verification failed";
		}

		this.logger.info( "WebAuthn authentication verified for user:", user.username );

		await this.db.update( schema.passkeys )
			.set( { counter: verification.authenticationInfo.newCounter } )
			.where( eq( schema.passkeys.id, passkey.id ) );

		this.logger.info( "Passkey counter updated for user:", user.id );

		await this.kv.delete( username );
		this.logger.info( "Deleted WebAuthn options from KV for user:", username );

		this.logger.debug( "<< verifyLogin()" );
		return user;
	}

	/**
	 * Retrieve WebAuthn options from KV for given username
	 * @param username {string} - The username to retrieve options for
	 * @returns {Promise<WebauthnOptions>} The WebAuthn options
	 * @private
	 */
	private async getWebAuthnOptions( username: string ): Promise<WebauthnOptions> {
		this.logger.debug( ">> getWebAuthnOptions()" );

		const optionsJSON = await this.kv.get( username );
		if ( !optionsJSON ) {
			this.logger.error( "No WebAuthn options found for username:", username );
			throw "No WebAuthn options found for user";
		}

		const options = JSON.parse( optionsJSON ) as WebauthnOptions;
		this.logger.info( "Validated WebAuthn options for user:", username );

		this.logger.debug( "<< getWebAuthnOptions()" );
		return options;
	}
}