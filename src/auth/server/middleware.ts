import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { Unauthorized } from "@/auth/shared/schema.ts";
import { AuthContext, AuthMiddleware } from "@/auth/shared/middleware.ts";
import { SessionService } from "@/auth/server/session.ts";

export const AuthMiddlewareLive = Layer.effect(
	AuthMiddleware,
	Effect.gen( function* () {
		const sessions = yield* SessionService;

		return httpEffect => Effect.gen( function* () {
			const runtime = yield* Effect.serviceOption( Alchemy.RuntimeContext );
			if ( Option.isNone( runtime ) ) {
				return yield* Effect.die( "RuntimeContext missing from request scope" );
			}

			const user = yield* sessions.load().pipe(
				Effect.provideService( Alchemy.RuntimeContext, runtime.value )
			);
			
			if ( !user ) {
				return yield* new Unauthorized();
			}

			return yield* httpEffect.pipe(
				Effect.provideService( AuthContext, AuthContext.of( { user } ) )
			);
		} );
	} )
);
