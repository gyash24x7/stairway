import type { AuthInfo } from "@/auth/core/types";
import { os } from "@orpc/server";

/**
 * Per-request context injected by the Worker fetch handler into every oRPC procedure.
 * `resHeaders` is a mutable header bag procedures use to emit `Set-Cookie` (session cookies),
 * which the Worker merges onto the final response after dispatch.
 */
export interface ORPCContext {
	env: Env;
	req: Request;
	ctx: ExecutionContext;
	user: AuthInfo | null;
	resHeaders: Headers;
}

/** Base procedure builder carrying the typed request context. */
export const base = os.$context<ORPCContext>();
