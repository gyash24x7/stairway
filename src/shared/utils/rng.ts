import * as Effect from "effect/Effect";
import * as Random from "effect/Random";


export type Rng = {
	readonly next: () => number;
	readonly int: ( max: number ) => number;
	readonly shuffle: <T>( arr: readonly T[] ) => T[];
};

/**
 * Build a deterministic `Rng` from arbitrary parts (a seed plus salts like
 * turn / decider role). Distinct part tuples give distinct streams, which is
 * how the engine keeps same-turn deciders from colliding. Parts are joined
 * into one seed string and handed to Effect's `Random` service via
 * `Random.withSeed` — its ISAAC-based generator hashes the string itself, so
 * no separate hash step is needed. `Random.Random` is a `Context.Reference`
 * (itself an `Effect`), so resolving it once with `Effect.runSync` hands back
 * the same stateful generator object `Random.next`/`Random.shuffle` use
 * internally, letting callers draw from it synchronously and repeatedly
 * without re-running an `Effect` per draw.
 */
export const makeRng = ( ...parts: ReadonlyArray<string | number> ) => {
	const seed = parts.join( "|" );
	const random = Effect.runSync( Random.Random.pipe( Random.withSeed( seed ) ) );

	const next = () => random.nextDoubleUnsafe();
	const int = ( max: number ) => Math.floor( next() * max );

	const shuffle = <T>( arr: readonly T[] ) => {
		const out = [ ...arr ];
		for ( let i = out.length - 1; i > 0; i-- ) {
			const j = int( i + 1 );
			const tmp = out[ i ]!;
			out[ i ] = out[ j ]!;
			out[ j ] = tmp;
		}
		return out;
	};

	return { next, int, shuffle };
};
