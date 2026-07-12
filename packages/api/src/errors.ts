// @s2h/api/errors — tagged errors + auth guard for the Effect HttpApi surface.
//
// Reuses Effect's built-in HTTP status errors (`HttpApiError.*`), which already
// carry their `httpApiStatus` annotation, so an endpoint that lists one in its
// `error` union renders the right status automatically. `requireUser` is the
// Effect analogue of the oRPC `authed` middleware: it reads `HttpAppContext` and
// fails `Unauthorized` when there is no session, otherwise yields the `AuthInfo`.

import { Effect } from "effect";
import { HttpApiError } from "effect/unstable/httpapi";
import type { AuthInfo } from "@s2h/utils/auth";
import { HttpAppContext } from "./context";

/** 400 — malformed request / failed validation. */
export const BadRequest = HttpApiError.BadRequest;
/** 401 — no (valid) session. */
export const Unauthorized = HttpApiError.Unauthorized;
/** 404 — resource not found. */
export const NotFound = HttpApiError.NotFound;

/** Guard: yields the authenticated user, or fails `Unauthorized`. */
export const requireUser: Effect.Effect<AuthInfo, HttpApiError.Unauthorized, HttpAppContext> =
	Effect.flatMap( HttpAppContext, ( context ) =>
		context.user
			? Effect.succeed( context.user )
			: Effect.fail( new HttpApiError.Unauthorized() ) );
