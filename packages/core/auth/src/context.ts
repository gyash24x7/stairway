// @s2h/auth/context — the per-request context service the auth handlers need.
//
// The effectful replacement for the old oRPC `HttpAppContext`. Auth handlers read
// the authenticated user and the request URL / Cookie header, and push their
// `Set-Cookie` value onto `setCookies`. `Context.Service` tags are Effects, so
// handlers do `yield* AuthHttpContext`. The serving Worker provides this
// PER REQUEST via a global `HttpRouter.middleware` (see `apps/api/src/worker.ts`),
// which reads the incoming `HttpServerRequest`, resolves the user via
// `loadSession`, and — after the handler runs — drains `setCookies` onto the
// outgoing `HttpServerResponse`. Until it is provided, `AuthApiLive`'s residual
// requirement is this service.

import * as Context from "effect/Context";
import type { AuthInfo } from "@s2h/utils/auth";

export class AuthHttpContext extends Context.Service<AuthHttpContext, {
	/** Absolute request URL — handlers derive `hostname` (rpID) / `origin` from it. */
	readonly url: string;
	/** Raw `Cookie` request header (empty string when absent). */
	readonly cookieHeader: string;
	/** The authenticated user for this request, or `null` when unauthenticated. */
	readonly user: AuthInfo | null;
	/** Mutable collector: handlers push `Set-Cookie` values; the Worker drains them onto the response. */
	readonly setCookies: string[];
}>()( "auth/HttpContext" ) {}
