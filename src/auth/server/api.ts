import { StairwayAPI } from "@/api.ts";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { BetterAuth } from "./services.ts";

// --- HTTP Api implementation -------------------------------------------------

/**
 * Delegates every `/api/auth/*` request to better-auth. `handleRaw` skips
 * payload decoding, and returning `BetterAuth.fetch` (an `HttpEffect` that reads
 * the ambient `HttpServerRequest`, runs `auth.handler`, and wraps the raw
 * `Response` back) passes the response through unencoded. `fetch` already turns
 * its own failures into a 500 response, so the residual `HttpEffect` error
 * channel is unexpected here — `orDie` absorbs it since the endpoints declare no
 * error type.
 */
export const AuthApiLive = HttpApiBuilder.group( StairwayAPI, "auth", handlers =>
	Effect.gen( function* () {
		const { fetch } = yield* BetterAuth;
		const passthrough = () => Effect.orDie( fetch );
		return handlers
			.handleRaw( "authGet", passthrough )
			.handleRaw( "authPost", passthrough );
	} )
);
