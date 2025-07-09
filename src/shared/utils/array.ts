/**
 * Shuffles an array using the Fisher-Yates algorithm.
 * @param {T[]} arr - The array to shuffle.
 * @returns {T[]} A new array with the elements shuffled.
 */
export function shuffle<T>( arr: T[] ): T[] {
	return arr
		.map( value => ( { value, sort: Math.random() } ) )
		.sort( ( a, b ) => a.sort - b.sort )
		.map( ( { value } ) => value );
}

/**
 * Splits an array into chunks of a specified size.
 * @param {T[]} arr - The array to split into chunks.
 * @param {number} size - The size of each chunk.
 * @returns {T[][]} An array of chunks, each containing up to `size` elements.
 */
export function chunk<T>( arr: T[], size: number ): T[][] {
	const chunks: T[][] = [];

	for ( let i = 0; i < arr.length; i += size ) {
		const chunk = arr.slice( i, i + size );
		chunks.push( chunk );
	}

	return chunks;
}