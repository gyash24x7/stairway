import * as Context from "effect/Context";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";

import { Unauthorized } from "@/auth/shared/schema.ts";

import type { AuthInfo } from "@/auth/shared/schema.ts";

// --- Context -------------------------------------------------------------

export class AuthContext extends Context.Service<AuthContext, {
	readonly user: AuthInfo;
}>()( "auth/Context" ) {}


// --- Middleware -------------------------------------------------------------

export class AuthMiddleware extends HttpApiMiddleware.Service<
	AuthMiddleware,
	{ provides: AuthContext }
>()( "auth/Authorization", { error: Unauthorized } ) {}
