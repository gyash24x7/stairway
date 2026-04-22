import type { ResolveNextPlayerFn } from "@/shared/engine/types";

/**
 * A round-robin player resolution function that cycles through players based on turn number.
 * Each turn advances to the next player in the list, wrapping around when reaching the end.
 *
 * @param data - The readonly game data containing context with turn count and player list.
 * @returns The player ID of the next player in rotation.
 */
export const roundRobin: ResolveNextPlayerFn<any, any, any> = ( { context } ) => {
	const index = context.turn % context.players.length;
	return context.players[ index ];
};
