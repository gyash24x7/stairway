import { type AuthInfo, Unauthorized } from "@/auth/shared/schema.ts";
import * as Context from "effect/Context";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";


// --- Context -------------------------------------------------------------

export class AuthContext extends Context.Service<AuthContext, {
	readonly user: AuthInfo;
}>()( "auth/Context" ) {}


// --- Middleware -------------------------------------------------------------

export class AuthMiddleware extends HttpApiMiddleware.Service<
	AuthMiddleware,
	{ provides: AuthContext }
>()( "auth/Authorization", { error: Unauthorized } ) {}
