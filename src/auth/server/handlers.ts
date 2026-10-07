import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import * as Base64Url from "effect/encoding/Base64Url";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

import { AuthApi } from "@/auth/contract";
import {
	AuthenticationFailed,
	LoginFlow,
	RegistrationFailed,
	RegistrationFlow,
	UsernameTaken
} from "@/auth/schema";
import { AuthRepository } from "@/auth/server/repository";
import { SessionService } from "@/auth/server/sessions";
import { WebAuthnService } from "@/auth/server/webauthn";
import { Generator } from "@/shared/utils/generator";


export const AuthApiLive = HttpApiBuilder.group(
	AuthApi,
	"auth",
	Effect.fn( function* ( handlers ) {
		const sessions = yield* SessionService;
		const webauthn = yield* WebAuthnService;
		const repository = yield* AuthRepository;
		const generator = yield* Generator;

		return handlers
			.handle( "registerOptions", Effect.fn( function* ( { payload } ) {
				const existing = yield* repository.findUserByUsername( payload.username );

				if ( Option.isSome( existing ) ) {
					return yield* new UsernameTaken( { username: payload.username } );
				}

				const options = yield* webauthn.getRegisterOptions( payload.username );
				const flow = RegistrationFlow.make( {
					id: yield* generator.generateId(),
					challenge: options.challenge,
					...payload
				} );

				yield* webauthn.setAuthFlow( flow );

				return { flowId: flow.id, options };
			} ) )

			.handle( "registerVerify", Effect.fn( function* ( { payload } ) {

				const flow = yield* webauthn.getAuthFlow( payload.flowId );
				if ( Option.isNone( flow ) ) {
					return yield* new RegistrationFailed( {
						reason: "Registration flow expired. Try again."
					} );
				}

				if ( flow.value._tag !== "auth/RegistrationFlow" ) {
					return yield* new RegistrationFailed( {
						reason: "Incorrect Flow! Try again."
					} );
				}

				yield* webauthn.deleteAuthFlow( flow.value.id );

				const verification = yield* webauthn.verifyRegistration(
					payload.response as RegistrationResponseJSON,
					flow.value.challenge
				);

				if ( !verification.verified || !verification.registrationInfo ) {
					return yield* new RegistrationFailed( {
						reason: "Passkey could not be verified."
					} );
				}

				const user = yield* repository.createUser( {
					name: flow.value.name,
					username: flow.value.username,
					avatar: yield* generator.generateAvatar( flow.value.username )
				} );

				const { registrationInfo } = verification;

				yield* repository.createPasskey( {
					name: flow.value.username,
					userId: user.id,
					credentialId: registrationInfo.credential.id,
					publicKey: Base64Url.encode( registrationInfo.credential.publicKey ),
					counter: registrationInfo.credential.counter
				} );

				yield* sessions.issue( user ).pipe( Effect.orDie );
				return user;
			} ) )

			.handle( "loginOptions", Effect.fn( function* () {

				const options = yield* webauthn.getLoginOptions();
				const flow = LoginFlow.make( {
					id: yield* generator.generateId(),
					challenge: options.challenge
				} );

				yield* webauthn.setAuthFlow( flow );

				return { flowId: flow.id, options };
			} ) )

			.handle( "loginVerify", Effect.fn( function* ( { payload } ) {

				const flow = yield* webauthn.getAuthFlow( payload.flowId );
				if ( Option.isNone( flow ) ) {
					return yield* new AuthenticationFailed( {
						reason: "Login flow expired. Try again."
					} );
				}

				if ( flow.value._tag !== "auth/LoginFlow" ) {
					return yield* new AuthenticationFailed( {
						reason: "Incorrect Flow! Try again."
					} );
				}

				const login = flow.value;
				yield* webauthn.deleteAuthFlow( login.id );

				const response = payload.response as AuthenticationResponseJSON;
				const passkey = yield* repository.findPasskeyByCredentialId( response.id );

				if ( Option.isNone( passkey ) ) {
					return yield* new AuthenticationFailed( {
						reason: "Unknown passkey."
					} );
				}

				const user = yield* repository.findUserById( passkey.value.userId );

				if ( Option.isNone( user ) ) {
					return yield* new AuthenticationFailed( {
						reason: "Account not found."
					} );
				}

				const publicKeyResult = Base64Url.decode( passkey.value.publicKey );
				if ( Result.isFailure( publicKeyResult ) ) {
					return yield* new AuthenticationFailed( {
						reason: "Invalid Passkey."
					} );
				}

				const credential = {
					id: passkey.value.credentialId,
					publicKey: publicKeyResult.success as Uint8Array<ArrayBuffer>,
					counter: passkey.value.counter
				};

				const verification = yield* webauthn.verifyLogin( response, login.challenge, credential );
				if ( !verification.verified || !verification.authenticationInfo ) {
					return yield* new AuthenticationFailed( {
						reason: "Passkey could not be verified."
					} );
				}

				yield* repository.updatePasskeyCounter(
					passkey.value.id,
					verification.authenticationInfo.newCounter
				);

				yield* sessions.issue( user.value ).pipe( Effect.orDie );
				return user.value;
			} ) )

			.handle( "me", () => sessions.load().pipe( Effect.map( Option.getOrNull ) ) )

			.handle( "logout", () => sessions.clear() );
	} )
);
