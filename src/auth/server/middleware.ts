import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { AuthContext, AuthMiddleware } from "@/auth/contract";
import { Unauthorized } from "@/auth/schema";
import { SessionService } from "@/auth/server/sessions";


export const AuthMiddlewareLive = Layer.effect(
	AuthMiddleware,
	Effect.gen( function* () {
		const sessions = yield* SessionService;

		return httpEffect => Effect.gen( function* () {
			const user = yield* sessions.load();
			if ( Option.isNone( user ) ) {
				return yield* new Unauthorized();
			}

			return yield* httpEffect.pipe(
				Effect.provideService( AuthContext, AuthContext.of( user.value ) )
			);
		} );
	} )
);
