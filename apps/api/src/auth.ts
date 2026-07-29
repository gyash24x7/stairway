import { AuthHttpContext } from "@s2h/auth/context";
import { AuthService } from "@s2h/auth/service";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";

export class LoadAuthMiddleware extends HttpApiMiddleware.Service<
	LoadAuthMiddleware,
	{ provides: AuthHttpContext }
>()( "app/LoadAuthMiddleware" ) {

	public static readonly layer = Layer.effect( LoadAuthMiddleware, Effect.gen( function* () {
		const authService = yield* AuthService;
		return ( effect ) => Effect.provideServiceEffect(
			effect,
			AuthHttpContext,
			Effect.gen( function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const cookieHeader = request.headers[ "cookie" ] ?? "";
				const user = yield* authService.loadAuthInfo( cookieHeader );
				return AuthHttpContext.of( { url: request.url, cookieHeader, user, setCookies: [] } );
			} )
		);
	} ) );
}

export const RequireAuthMiddleware = HttpMiddleware.make( ( effect ) =>
	Effect.gen( function* () {
		const ctx = yield* AuthHttpContext;
		if ( !ctx.user ) {
			return yield* new HttpApiError.Unauthorized();
		}

		return yield* effect;
	} ) );