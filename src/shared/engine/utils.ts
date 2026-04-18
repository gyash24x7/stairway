import type { ResolveNextPlayerFn } from "@/shared/engine/types";

export const roundRobin: ResolveNextPlayerFn<any, any, any> = ( { context } ) => {
	const index = context.turn % context.players.length;
	return context.players[ index ];
};
