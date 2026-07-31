import * as Context from "effect/Context";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";

import { type AuthInfo, Unauthorized } from "@/auth/shared/schema.ts";


// --- Context -------------------------------------------------------------

export class AuthContext extends Context.Service<AuthContext, {
	readonly user: AuthInfo;
}>()( "auth/Context" ) {}


// --- Middleware -------------------------------------------------------------

// `requires` stays `never`: the middleware's KV-backed session lookup needs
// Alchemy's `RuntimeContext`, but it discharges that from the ambient request
// context internally (see `AuthMiddlewareLive`). Declaring it here would promote
// `RuntimeContext` to a *static* layer dependency of the whole API, forcing a
// `RuntimeContext.phantom` at assembly time — exactly what we're avoiding.
export class AuthMiddleware extends HttpApiMiddleware.Service<
	AuthMiddleware,
	{ provides: AuthContext }
>()( "auth/Authorization", { error: Unauthorized } ) {}
