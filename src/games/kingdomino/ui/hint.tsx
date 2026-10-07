import type { Domino, KingdominoHint } from "@/games/kingdomino/schema";
import { hintAtom } from "@/games/kingdomino/ui/client";
import { getDomino } from "@/games/kingdomino/utils";
import { GameId } from "@/swish/schema";
import { HintButton, NO_HINT, useHint } from "@/swish/ui/hint";


/** A domino by its two halves, since its number alone names nothing. */
const nameOf = ( dominoId: number ) => {
	const domino: Domino | undefined = getDomino( dominoId );
	if ( !domino ) {
		return `DOMINO ${ dominoId }`;
	}

	const crowns = domino.left.crowns + domino.right.crowns;
	const halves = `${ domino.left.terrain.toUpperCase() } / ${ domino.right.terrain.toUpperCase() }`;
	return crowns > 0 ? `${ halves } (${ crowns } CROWN${ crowns > 1 ? "S" : "" })` : halves;
};

export const describeHint = ( { move }: KingdominoHint ) => {
	if ( !move ) {
		return NO_HINT;
	}

	switch ( move.moveType ) {
		case "selectDomino":
			return `TAKE THE ${ nameOf( move.input.dominoId ) }`;

		case "placeDomino": {
			const { coord, rotation, dominoId } = move.input.placement;
			return `LAY THE ${ nameOf( dominoId ) } AT ${ coord.x },${ coord.y } TURNED ${ rotation }°`;
		}

		case "discardDomino":
			return `DISCARD THE ${ nameOf( move.input.dominoId ) } — IT WILL NOT FIT`;
	}
};

export type KingdominoHintProps = {
	readonly gameId: string;
	readonly disabled?: boolean;
};

export function KingdominoHint( { gameId, disabled }: KingdominoHintProps ) {
	const request = { params: { gameId: GameId.make( gameId ) } };
	return <HintButton { ...useHint( hintAtom, request, describeHint ) } disabled={ disabled }/>;
}
