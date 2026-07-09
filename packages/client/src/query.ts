import { client } from "./client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

/**
 * TanStack Query utilities for every procedure, e.g.
 * `orpc.wordle.getGame.queryOptions({ input })`, `orpc.wordle.submitGuess.mutationOptions()`,
 * and `orpc.wordle.getGame.key()` for cache invalidation.
 */
export const orpc = createTanstackQueryUtils( client );
