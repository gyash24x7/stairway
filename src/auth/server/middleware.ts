import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";

import { AuthInfo, Unauthorized } from "@/auth/shared/schema.ts";
import { AuthContext, AuthMiddleware } from "@/auth/shared/middleware.ts";
import { BetterAuth } from "@/auth/server/services.ts";

export const AuthMiddlewareLive = Layer.effect(
	AuthMiddleware,
	Effect.gen( function* () {
		const { auth } = yield* BetterAuth;

		return httpEffect => Effect.gen( function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const result = yield* Effect.promise( () =>
				auth.api.getSession( { headers: request.headers } )
			);

			if ( !result ) {
				return yield* new Unauthorized();
			}

			const ctx = AuthContext.of( {
				user: AuthInfo.make( {
					id: result.user.id,
					name: result.user.name,
					avatar: result.user.image ?? ""
				} )
			} );

			return yield* httpEffect.pipe( Effect.provideService( AuthContext, ctx ) );
		} );
	} )
);

