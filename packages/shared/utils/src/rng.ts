// @s2h/utils/rng — a tiny seeded, deterministic PRNG.
//
// Pure / browser-safe. Used by the swish engine so game randomness (shuffles,
// deals, dice) is reproducible from a stored seed and replay-exact: the same
// seed always yields the same stream. NOT cryptographically secure — never use
// it for secrets or anything an adversary must not predict.

export type Rng = {
	readonly next: () => number;
	readonly int: ( max: number ) => number;
	readonly shuffle: <T>( arr: readonly T[] ) => T[];
};

/**
 * Fold arbitrary parts (a seed plus salts like turn / decider role) into a
 * uint32 seed via the xmur3 string hash. Distinct part tuples give distinct
 * streams, which is how the engine keeps same-turn deciders from colliding.
 * @param parts
 */
export const hashSeed = ( ...parts: ReadonlyArray<string | number> ): number => {
	const str = parts.join( "|" );
	let h = 1779033703 ^ str.length;
	for ( let i = 0; i < str.length; i++ ) {
		h = Math.imul( h ^ str.charCodeAt( i ), 3432918353 );
		h = ( h << 13 ) | ( h >>> 19 );
	}
	h = Math.imul( h ^ ( h >>> 16 ), 2246822507 );
	h = Math.imul( h ^ ( h >>> 13 ), 3266489909 );
	return ( h ^ ( h >>> 16 ) ) >>> 0;
};

/**
 * mulberry32: a fast 32-bit PRNG. Returns a fn producing floats in [0, 1).
 * @param seed - A numeric seed
 */
export const mulberry32 = ( seed: number ): ( () => number ) => {
	let a = seed >>> 0;
	return () => {
		a = ( a + 0x6d2b79f5 ) | 0;
		let t = Math.imul( a ^ ( a >>> 15 ), 1 | a );
		t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
	};
};

/**
 * Build an `Rng` from a numeric seed.
 * @param seed - A numeric seed
 */
export const makeRng = ( seed: number ): Rng => {
	const next = mulberry32( seed );
	const int = ( max: number ) => Math.floor( next() * max );
	const shuffle = <T>( arr: readonly T[] ): T[] => {
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
