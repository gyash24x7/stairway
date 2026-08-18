import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SessionService } from "@/auth/server/session.ts";
import { AuthContext, AuthMiddleware } from "@/auth/shared/middleware.ts";
import { Unauthorized } from "@/auth/shared/schema.ts";


// --- Auth Middleware Implementation -------------------------------------------------

export const AuthMiddlewareLive = Layer.effect(
	AuthMiddleware,
	Effect.gen( function* () {
		const sessions = yield* SessionService;

		return httpEffect => Effect.gen( function* () {
			const user = yield* sessions.load();
			if ( !user ) {
				return yield* new Unauthorized();
			}

			return yield* httpEffect.pipe(
				Effect.provideService( AuthContext, AuthContext.of( { user } ) )
			);
		} );
	} )
);
