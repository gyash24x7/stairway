/**
 * Shuffles an array by decorating each element with a random sort key.
 * @template T - The type of elements in the array.
 * @param arr - The array to shuffle.
 * @param rng - Randomness source in [0, 1); defaults to Math.random.
 * 	Pass a seeded generator for a deterministic, reproducible shuffle.
 */
export function shuffle<T>( arr: T[], rng: () => number = Math.random ) {
	return arr
		.map( value => ( { value, sort: rng() } ) )
		.sort( ( a, b ) => a.sort - b.sort )
		.map( ( { value } ) => value );
}

/**
 * Splits an array into chunks of a specified size.
 * @template T - The type of elements in the array.
 * @param arr - The array to split into chunks.
 * @param size - The size of each chunk.
 * @returns An array of chunks, each containing up to `size` elements.
 */
export function chunk<T>( arr: T[], size: number ) {
	const chunks: T[][] = [];

	for ( let i = 0; i < arr.length; i += size ) {
		const chunk = arr.slice( i, i + size );
		chunks.push( chunk );
	}

	return chunks;
}

/**
 * Removes elements from an array based on a predicate function.
 * @template T - The type of elements in the array.
 * @param predicate - A Predicate to check if element is to be removed.
 * @param arr - The array to filter.
 * @returns A new array with elements that do not match the predicate.
 */
export function remove<T>( predicate: ( elem: T ) => boolean, arr: T[] ) {
	return arr.filter( elem => !predicate( elem ) );
}

/**
 * Returns the keys of an object as an array, with proper typing.
 * @template T - The type of the object.
 * @param obj - The object whose keys are to be retrieved.
 * @returns An array of the object's keys.
 */
export function objectKeys<T extends Record<string, unknown>>( obj: T ) {
	return Object.keys( obj ) as ( keyof T )[];
}
