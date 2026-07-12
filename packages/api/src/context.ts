// @s2h/api/context — the per-request context for the Effect HttpApi surface.
//
// The Effect twin of `ORPCContext` (see ./orpc.ts). Where oRPC threads a context
// object through every procedure, the Effect API exposes it as a `Context.Service`
// tag that handlers pull from. `resHeaders` is the same mutable header bag idea:
// handlers append `Set-Cookie` (session cookies) to it, and the Worker merges it
// onto the final response after dispatch. Provided per-request by the host (not
// wired up yet — this is additive; the oRPC context stays for unmigrated code).

import { Context } from "effect";
import type { AuthInfo } from "@s2h/utils/auth";

export class HttpAppContext extends Context.Service<HttpAppContext, {
	readonly env: Env;
	readonly req: Request;
	readonly ctx: ExecutionContext;
	readonly user: AuthInfo | null;
	readonly resHeaders: Headers;
}>()( "api/HttpAppContext" ) {}
