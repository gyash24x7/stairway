import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import type {
	AuthenticationResponseJSON,
	AuthenticatorTransportFuture,
	RegistrationResponseJSON
} from "@simplewebauthn/server";

import { StairwayAPI } from "@/api.ts";
import { SessionService } from "@/auth/server/session.ts";
import { WebAuthnService } from "@/auth/server/webauthn.ts";
import {
	AuthenticationFailed,
	AuthInfo,
	EmailTaken,
	LoginFlow,
	RegistrationFailed,
	RegistrationFlow,
	UserId
} from "@/auth/shared/schema.ts";
import { passkeys, users } from "@/platform/database/schema.ts";
import { Database } from "@/platform/database/service.ts";
import { generateId } from "@/shared/utils/generator.ts";


// --- Auth Http Api Implementation -------------------------------------------------

export const AuthApiLive = HttpApiBuilder.group( StairwayAPI, "auth", handlers =>
	Effect.gen( function* () {
		const db = yield* Database;
		const sessions = yield* SessionService;
		const webauthn = yield* WebAuthnService;

		return handlers
			.handle( "registerOptions", Effect.fn( function* ( { payload } ) {
				const existing = yield* db.query.users.findFirst( { where: { email: payload.email } } )
					.pipe( Effect.orDie );

				if ( existing ) {
					return yield* new EmailTaken( { email: payload.email } );
				}

				const options = yield* webauthn.getRegisterOptions( payload.email );
				const flow = RegistrationFlow.make( {
					id: generateId(),
					challenge: options.challenge,
					name: payload.name,
					email: payload.email
				} );

				yield* webauthn.setAuthFlow( flow );

				return { flowId: flow.id, options };
			} ) )

			.handle( "registerVerify", Effect.fn( function* ( { payload } ) {
				const flow = yield* webauthn.getAuthFlow( payload.flowId );
				if ( !flow ) {
					return yield* new RegistrationFailed( {
						reason: "Registration flow expired. Try again."
					} );
				}

				if ( flow._tag !== "auth/RegistrationFlow" ) {
					return yield* new RegistrationFailed( {
						reason: "Incorrect Flow! Try again."
					} );
				}

				yield* webauthn.deleteAuthFlow( flow.id );

				const verification = yield* webauthn.verifyRegistration(
					payload.response as RegistrationResponseJSON,
					flow.challenge
				);

				if ( !verification.verified || !verification.registrationInfo ) {
					return yield* new RegistrationFailed( {
						reason: "Passkey could not be verified."
					} );
				}

				const user = yield* db.insert( users )
					.values( { name: flow.name, email: flow.email } ).returning()
					.pipe(
						Effect.map( v => v[ 0 ] ),
						Effect.orDie
					);

				const passkey = {
					name: flow.email,
					userId: user.id,
					credentialID: verification.registrationInfo.credential.id,
					publicKey: isoBase64URL.fromBuffer( verification.registrationInfo.credential.publicKey ),
					counter: verification.registrationInfo.credential.counter,
					deviceType: verification.registrationInfo.credentialDeviceType,
					backedUp: verification.registrationInfo.credentialBackedUp,
					aaguid: verification.registrationInfo.aaguid,
					transports: verification.registrationInfo.credential.transports
						? JSON.stringify( verification.registrationInfo.credential.transports )
						: null
				};

				yield* db.insert( passkeys ).values( passkey ).pipe( Effect.orDie );

				const authInfo = AuthInfo.make( {
					id: UserId.make( user.id ),
					name: user.name,
					avatar: user.image ?? ""
				} );

				yield* sessions.issue( authInfo );
				return authInfo;
			} ) )

			.handle( "loginOptions", Effect.fn( function* () {
				const options = yield* webauthn.getLoginOptions();
				const flow = LoginFlow.make( {
					id: generateId(),
					challenge: options.challenge
				} );

				yield* webauthn.setAuthFlow( flow );

				return { flowId: flow.id, options };
			} ) )

			.handle( "loginVerify", Effect.fn( function* ( { payload } ) {
				const flow = yield* webauthn.getAuthFlow( payload.flowId );
				if ( !flow ) {
					return yield* new AuthenticationFailed( {
						reason: "Login flow expired. Try again."
					} );
				}

				if ( flow._tag !== "auth/LoginFlow" ) {
					return yield* new AuthenticationFailed( {
						reason: "Incorrect Flow! Try again."
					} );
				}

				yield* webauthn.deleteAuthFlow( flow.id );

				const response = payload.response as AuthenticationResponseJSON;

				const passkey = yield* db.query.passkeys
					.findFirst( { where: { credentialID: response.id } } )
					.pipe( Effect.orDie );

				if ( !passkey ) {
					return yield* new AuthenticationFailed( {
						reason: "Unknown passkey."
					} );
				}

				const user = yield* db.query.users
					.findFirst( { where: { id: passkey.userId } } )
					.pipe( Effect.orDie );

				if ( !user ) {
					return yield* new AuthenticationFailed( {
						reason: "Account not found."
					} );
				}

				const verification = yield* webauthn.verifyLogin(
					response,
					flow.challenge,
					{
						id: passkey.credentialID,
						publicKey: isoBase64URL.toBuffer( passkey.publicKey ),
						counter: passkey.counter,
						transports: passkey.transports
							? JSON.parse( passkey.transports ) as AuthenticatorTransportFuture[]
							: undefined
					}
				);

				if ( !verification.verified ) {
					return yield* new AuthenticationFailed( {
						reason: "Passkey could not be verified."
					} );
				}

				yield* db.update( passkeys )
					.set( { counter: verification.authenticationInfo.newCounter } )
					.where( eq( passkeys.id, passkey.id ) )
					.pipe( Effect.orDie );

				const authInfo = AuthInfo.make( {
					id: UserId.make( user.id ),
					name: user.name,
					avatar: user.image ?? ""
				} );

				yield* sessions.issue( authInfo );
				return authInfo;
			} ) )

			.handle( "me", () => sessions.load() )

			.handle( "logout", () => sessions.clear() );
	} )
);
