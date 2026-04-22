import { shuffle } from "@/shared/utils/array";
import type { Card, CardLevel, Cost, Noble, PlayerInfo, Tokens } from "@/splendor/core/types";

export const GEMS: Array<keyof Cost> = [ "diamond", "sapphire", "emerald", "ruby", "onyx" ];
export const GEMS_WITH_GOLD: Array<keyof Tokens> = [ ...GEMS, "gold" ];
export const DEFAULT_COST: Cost = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
export const DEFAULT_TOKENS: Tokens = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 };

export function costToString( cost: Cost ) {
	return GEMS.map( gem => `${ gem[ 0 ] }${ cost[ gem ] }` ).join( "-" );
}

export function generateNobles( playerCount: number ): Noble[] {
	const costs: Cost[] = [];

	for ( let i = 0; i < GEMS.length; i++ ) {
		for ( let j = i + 1; j < GEMS.length; j++ ) {
			const cost = { ...DEFAULT_COST };
			cost[ GEMS[ i ] ] = 4;
			cost[ GEMS[ j ] ] = 4;
			costs.push( cost );
		}
	}

	for ( let i = 0; i < GEMS.length; i++ ) {
		for ( let j = i + 1; j < GEMS.length; j++ ) {
			for ( let k = j + 1; k < GEMS.length; k++ ) {
				const cost = { ...DEFAULT_COST };
				cost[ GEMS[ i ] ] = 3;
				cost[ GEMS[ j ] ] = 3;
				cost[ GEMS[ k ] ] = 3;
				costs.push( cost );
			}
		}
	}

	const allNobles = costs.map( cost => ( { id: costToString( cost ), points: 3, cost } ) );
	return shuffle( allNobles ).slice( 0, playerCount + 1 );
}

const level3MatrixPointMap = {
	3: [
		[ 0, 3, 3, 5, 3 ],
		[ 3, 0, 3, 3, 5 ],
		[ 5, 3, 0, 3, 3 ],
		[ 3, 5, 3, 0, 3 ],
		[ 3, 3, 5, 3, 0 ]
	],
	4: [
		[ 3, 0, 0, 3, 6 ],
		[ 6, 3, 0, 0, 3 ],
		[ 3, 6, 3, 0, 0 ],
		[ 0, 3, 6, 3, 0 ],
		[ 0, 0, 3, 6, 3 ],
		[ 0, 0, 0, 0, 7 ],
		[ 7, 0, 0, 0, 0 ],
		[ 0, 7, 0, 0, 0 ],
		[ 0, 0, 7, 0, 0 ],
		[ 0, 0, 0, 7, 0 ]
	],
	5: [
		[ 3, 0, 0, 0, 7 ],
		[ 7, 3, 0, 0, 0 ],
		[ 0, 7, 3, 0, 0 ],
		[ 0, 0, 7, 3, 0 ],
		[ 0, 0, 0, 7, 3 ]
	]
};

const level2MatrixPointMap = {
	3: [
		[ 6, 0, 0, 0, 0 ],
		[ 0, 6, 0, 0, 0 ],
		[ 0, 0, 6, 0, 0 ],
		[ 0, 0, 0, 6, 0 ],
		[ 0, 0, 0, 0, 6 ]
	],
	2: [
		[ 0, 0, 0, 5, 0 ],
		[ 0, 0, 0, 0, 5 ],
		[ 5, 0, 0, 0, 0 ],
		[ 0, 5, 0, 0, 0 ],
		[ 0, 0, 5, 0, 0 ],
		[ 0, 0, 0, 5, 3 ],
		[ 3, 0, 0, 0, 5 ],
		[ 5, 3, 0, 0, 0 ],
		[ 0, 5, 3, 0, 0 ],
		[ 0, 0, 5, 3, 0 ],
		[ 0, 0, 1, 4, 2 ],
		[ 2, 0, 0, 1, 4 ],
		[ 4, 2, 0, 0, 1 ],
		[ 1, 4, 2, 0, 0 ],
		[ 0, 1, 4, 2, 0 ]
	],
	1: [
		[ 2, 3, 0, 0, 2 ],
		[ 2, 2, 3, 0, 0 ],
		[ 0, 2, 2, 3, 0 ],
		[ 0, 0, 2, 2, 3 ],
		[ 3, 0, 0, 2, 2 ],
		[ 0, 0, 3, 2, 2 ],
		[ 2, 0, 0, 3, 2 ],
		[ 2, 2, 0, 0, 3 ],
		[ 3, 2, 2, 0, 0 ],
		[ 0, 3, 2, 2, 0 ]
	]
};

const level1MatrixPointMap = {
	1: [
		[ 0, 0, 4, 0, 0 ],
		[ 0, 0, 0, 4, 0 ],
		[ 0, 0, 0, 0, 4 ],
		[ 4, 0, 0, 0, 0 ],
		[ 0, 4, 0, 0, 0 ]
	],
	0: [
		[ 0, 0, 0, 3, 0 ],
		[ 0, 0, 0, 0, 3 ],
		[ 3, 0, 0, 0, 0 ],
		[ 0, 3, 0, 0, 0 ],
		[ 0, 0, 3, 0, 0 ],
		[ 0, 1, 1, 1, 1 ],
		[ 1, 0, 1, 1, 1 ],
		[ 1, 1, 0, 1, 1 ],
		[ 1, 1, 1, 0, 1 ],
		[ 1, 1, 1, 1, 0 ],
		[ 0, 1, 2, 1, 1 ],
		[ 1, 0, 1, 2, 1 ],
		[ 1, 1, 0, 1, 2 ],
		[ 2, 1, 1, 0, 1 ],
		[ 1, 2, 1, 1, 0 ],
		[ 0, 2, 2, 0, 1 ],
		[ 1, 0, 2, 2, 0 ],
		[ 0, 1, 0, 2, 2 ],
		[ 2, 0, 1, 0, 2 ],
		[ 2, 2, 0, 1, 0 ],
		[ 3, 0, 1, 0, 1 ],
		[ 1, 3, 0, 1, 0 ],
		[ 0, 1, 3, 0, 1 ],
		[ 1, 0, 1, 3, 0 ],
		[ 0, 1, 0, 1, 3 ],
		[ 0, 2, 0, 0, 2 ],
		[ 2, 0, 2, 0, 0 ],
		[ 0, 2, 0, 2, 0 ],
		[ 0, 0, 2, 0, 2 ],
		[ 2, 0, 0, 2, 0 ],
		[ 0, 0, 2, 1, 0 ],
		[ 0, 0, 0, 2, 1 ],
		[ 1, 0, 0, 0, 2 ],
		[ 2, 1, 0, 0, 0 ],
		[ 0, 2, 1, 0, 0 ]
	]
};

function buildCost( gems: typeof GEMS, costArray: number[] ): Cost {
	return gems.reduce( ( acc, gem, idx ) => {
		acc[ gem ] = costArray[ idx ];
		return acc;
	}, { ...DEFAULT_COST } );
}

function generateDeckForMatrixPointMap( gems: typeof GEMS, level: CardLevel, map: Record<number, number[][]> ): Card[] {
	return Object.keys( map )
		.map( p => parseInt( p ) )
		.flatMap( ( points ) => map[ points ].map( ( costArray, idx ) => {
			const bonus = gems[ idx % 5 ];
			const cost = buildCost( gems, costArray );
			const id = `L${ level }-P${ points }-${ costToString( cost ) }-B${ bonus.charAt( 0 ) }`;
			return { id, level, points, cost, bonus };
		} ) );
}

export function generateDecks(): Record<CardLevel, Card[]> {
	const gems = shuffle( GEMS );
	return {
		3: shuffle( generateDeckForMatrixPointMap( gems, 3, level3MatrixPointMap ) ),
		2: shuffle( generateDeckForMatrixPointMap( gems, 2, level2MatrixPointMap ) ),
		1: shuffle( generateDeckForMatrixPointMap( gems, 1, level1MatrixPointMap ) )
	};
}

function getPlayerBonuses( player: PlayerInfo ): Cost {
	const bonuses: Cost = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
	for ( const card of player.cards ) {
		bonuses[ card.bonus ]++;
	}
	return bonuses;
}

export function findCardInOpenCards( cardId: string, cards: Record<CardLevel, Card[]> ) {
	for ( const level of [ 1, 2, 3 ] as CardLevel[] ) {
		const card = cards[ level ].find( card => card?.id === cardId );
		if ( card ) {
			return card;
		}
	}
	return undefined;
}

export function checkNobleVisit( player: PlayerInfo, nobles: Noble[] ): string | undefined {
	const bonuses = getPlayerBonuses( player );

	for ( const noble of nobles ) {
		const qualifies = GEMS.every( gem => bonuses[ gem ] >= noble.cost[ gem ] );
		if ( qualifies ) {
			return noble.id;
		}
	}

	return undefined;
}
