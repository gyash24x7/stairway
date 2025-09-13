import { createLogger } from "@/utils/logger";
import type {
	AuthInfo,
	GetAuthOptionsInput,
	VerifyLoginInput,
	VerifyRegistrationInput,
	WebauthnOptions
} from "@/workers/auth/schema";
import { passkeys, users } from "@/workers/auth/schema";
import {
	type AuthenticationResponseJSON,
	generateAuthenticationOptions,
	generateRegistrationOptions,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialRequestOptionsJSON,
	type RegistrationResponseJSON,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { WorkerEntrypoint } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";

export interface IAuthRPC extends WorkerEntrypoint {
	userExists( username: string ): Promise<DataResponse<{ exists: boolean }>>;

	getRegistrationOptions( input: GetAuthOptionsInput ): Promise<DataResponse<PublicKeyCredentialCreationOptionsJSON>>;

	getLoginOptions( input: GetAuthOptionsInput ): Promise<DataResponse<PublicKeyCredentialRequestOptionsJSON>>;

	verifyRegistration( input: VerifyRegistrationInput ): Promise<DataResponse<AuthInfo>>;

	verifyLogin( input: VerifyLoginInput ): Promise<DataResponse<AuthInfo>>;
}

export default class AuthRPC extends WorkerEntrypoint<AuthWorkerEnv> implements IAuthRPC {

	private readonly logger = createLogger( "Auth:Rpc" );
	private readonly db: DrizzleD1Database<{ users: typeof users, passkeys: typeof passkeys }>;

	constructor( ctx: ExecutionContext, env: AuthWorkerEnv ) {
		super( ctx, env );
		this.db = drizzle( env.DB, { schema: { users, passkeys } } );
	}

	async userExists( username: string ) {
		this.logger.debug( ">> userExists()" );
		const user = await this.db.query.users.findFirst( { where: eq( users.username, username ) } );
		this.logger.debug( "<< userExists()" );
		return { data: { exists: !!user }, error: undefined };
	}

	async getRegistrationOptions( input: GetAuthOptionsInput ) {
		this.logger.debug( ">> getRegistrationOptions()" );

		if ( !input.name ) {
			this.logger.error( "Name is required for Registration!" );
			return { error: "Name is required for Registration" };
		}

		const options = await generateRegistrationOptions( {
			userDisplayName: input.name,
			rpID: this.env.WEBAUTHN_RP_ID,
			rpName: this.env.APP_NAME,
			userName: input.username,
			attestationType: "none",
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "preferred"
			}
		} );

		const webAuthnOptions = { challenge: options.challenge, webauthnUserId: options.user.id };
		await this.env.WEBAUTHN_KV.put( input.username, JSON.stringify( webAuthnOptions ) );
		this.logger.info( "Stored WebAuthn options in KV for user:", input.username );

		this.logger.debug( "<< getRegistrationOptions()" );
		return { data: options };
	}

	async getLoginOptions( input: GetAuthOptionsInput ) {
		this.logger.debug( ">> getLoginOptions()" );

		const user = await this.db.query.users.findFirst( {
			where: eq( users.username, input.username )
		} );

		if ( !user ) {
			this.logger.error( "User not found for username:", input.username );
			return { error: "User not found" };
		}

		const options = await generateAuthenticationOptions( {
			rpID: this.env.WEBAUTHN_RP_ID,
			userVerification: "preferred",
			allowCredentials: []
		} );

		const webAuthnOptions = { challenge: options.challenge };
		await this.env.WEBAUTHN_KV.put( input.username, JSON.stringify( webAuthnOptions ) );
		this.logger.info( "Stored WebAuthn options in KV for user:", input.username );

		this.logger.debug( "<< getLoginOptions()" );
		return { data: options };
	}

	async verifyRegistration( input: VerifyRegistrationInput ) {
		this.logger.debug( ">> verifyRegistration()" );

		if ( !input.name ) {
			this.logger.error( "Name is required for Registration verification!" );
			return { error: "Name is required for Registration verification" };
		}

		const { error, data: options } = await this.getWebAuthnOptions( input.username );
		if ( error || !options ) {
			return { error };
		}

		const verification = await verifyRegistrationResponse( {
			response: input.response as RegistrationResponseJSON,
			expectedChallenge: options.challenge,
			expectedOrigin: this.env.APP_URL,
			expectedRPID: this.env.WEBAUTHN_RP_ID
		} );

		if ( !verification || !verification.verified || !verification.registrationInfo ) {
			this.logger.error( "WebAuthn verification failed for user:", input.username );
			return { error: "WebAuthn verification failed!" };
		}

		const user = await this.db.insert( users )
			.values( { name: input.name, username: input.username } )
			.returning().then( ( [ newUser ] ) => newUser );

		this.logger.info( "User created for WebAuthn registration:", user.id );

		const passkeyData = {
			id: verification.registrationInfo.credential.id,
			publicKey: verification.registrationInfo.credential.publicKey,
			userId: user.id,
			webauthnUserId: options.webauthnUserId!,
			counter: verification.registrationInfo.credential.counter
		};

		await this.db.insert( passkeys ).values( passkeyData );
		this.logger.info( "Passkey created for user:", user.id );

		await this.env.WEBAUTHN_KV.delete( input.username );
		this.logger.info( "Deleted WebAuthn options from KV for user:", input.username );

		this.logger.debug( "<< verifyRegistration()" );
		return { data: user };
	}

	async verifyLogin( input: VerifyLoginInput ) {
		this.logger.debug( ">> verifyLogin()" );

		const { error, data: options } = await this.getWebAuthnOptions( input.username );
		if ( error || !options ) {
			return { error };
		}

		const user = await this.db.query.users.findFirst( {
			where: eq( users.username, input.username )
		} );

		if ( !user ) {
			this.logger.error( "User not found for username:", input.username );
			return { error: "User not found" };
		}

		const passkey = await this.db.query.passkeys.findFirst( {
			where: and(
				eq( passkeys.id, input.response.id ),
				eq( passkeys.userId, user.id )
			)
		} );

		if ( !passkey ) {
			this.logger.error( "Passkey not found for user:", user.id, "with ID:", input.response.id );
			return { error: "Passkey not found" };
		}

		this.logger.info( "Passkey exists for user:", user.id );

		const verification = await verifyAuthenticationResponse( {
			response: input.response as AuthenticationResponseJSON,
			expectedChallenge: options.challenge,
			expectedOrigin: this.env.APP_URL,
			expectedRPID: this.env.WEBAUTHN_RP_ID,
			credential: {
				id: passkey.id,
				publicKey: passkey.publicKey,
				counter: passkey.counter
			}
		} );

		if ( !verification || !verification.verified || !verification.authenticationInfo ) {
			this.logger.error( "WebAuthn authentication verification failed for user:", user.username );
			return { error: "WebAuthn authentication verification failed" };
		}

		this.logger.info( "WebAuthn authentication verified for user:", user.username );

		await this.db.update( passkeys )
			.set( { counter: verification.authenticationInfo.newCounter } )
			.where( and( eq( passkeys.id, passkey.id ), eq( passkeys.userId, user.id ) ) );

		this.logger.info( "Passkey counter updated for user:", user.id );

		await this.env.WEBAUTHN_KV.delete( input.username );
		this.logger.info( "Deleted WebAuthn options from KV for user:", input.username );

		this.logger.debug( "<< verifyLogin()" );
		return { data: user };
	}

	private async getWebAuthnOptions( username: string ) {
		this.logger.debug( ">> getWebAuthnOptions()" );

		const optionsJSON = await this.env.WEBAUTHN_KV.get( username );
		if ( !optionsJSON ) {
			this.logger.error( "No WebAuthn options found for username:", username );
			return { error: "No WebAuthn options found" };
		}

		const options = JSON.parse( optionsJSON ) as WebauthnOptions;
		this.logger.info( "Validated WebAuthn options for user:", username );

		this.logger.debug( "<< getWebAuthnOptions()" );
		return { data: options };
	}
}