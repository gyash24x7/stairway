export function shuffle<T>( arr: T[] ): T[] {
	return arr
		.map( value => {
			return { value, sort: Math.random() };
		} )
		.sort( ( a, b ) => a.sort - b.sort )
		.map( ( { value } ) => value );
}

export function chunk<T>( arr: T[], size: number ): T[][] {
	const chunks: T[][] = [];

	for ( let i = 0; i < arr.length; i += size ) {
		const chunk = arr.slice( i, i + size );
		chunks.push( chunk );
	}

	return chunks;
}

export function intersection<T>( arr1: T[], arr2: T[] ): T[] {
	return arr1.filter( a => arr2.includes( a ) );
}