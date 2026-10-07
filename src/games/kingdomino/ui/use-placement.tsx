import { CheckIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useState } from "react";

import type {
	Board,
	Coord,
	DiscardDominoInput,
	PlaceDominoInput,
	Rotation
} from "@/games/kingdomino/schema";
import {
	getPlacementCoordinates,
	getValidPlacements,
	getValidRotations
} from "@/games/kingdomino/utils";
import { Button } from "@/shared/primitives/button";

type UsePlacementParams = {
	board: Board;
	activeDominoId: number | null;
	canPlace: boolean;
	isPending: boolean;
	placeDomino: ( input: PlaceDominoInput ) => Promise<unknown>;
	discardDomino: ( input: DiscardDominoInput ) => Promise<unknown>;
	onClear?: () => void;
};

export function usePlacement( params: UsePlacementParams ) {
	const { activeDominoId, canPlace, isPending, placeDomino, discardDomino, onClear } = params;
	const [ tentative, setTentative ] = useState<{ coord: Coord; rotation: Rotation } | null>( null );

	const clear = () => {
		setTentative( null );
		onClear?.();
	};

	const handleCellClick = ( coord: Coord ) => {
		if ( !canPlace || !activeDominoId ) {
			return;
		}

		const valid = getValidRotations( params.board, activeDominoId, coord );
		const first = valid[ 0 ];
		if ( first === undefined ) {
			return;
		}

		const initial = tentative && valid.includes( tentative.rotation )
			? tentative.rotation
			: first;

		setTentative( { coord, rotation: initial } );
	};

	const handleConfirm = () => {
		if ( !tentative || !activeDominoId ) {
			return;
		}

		void placeDomino( { placement: { dominoId: activeDominoId, ...tentative } } )
			.then( clear );
	};

	const handleCancel = () => setTentative( null );

	const handleCycleRotation = () => {
		if ( !tentative || !activeDominoId ) {
			return;
		}

		const valid = getValidRotations( params.board, activeDominoId, tentative.coord );
		if ( valid.length === 0 ) {
			return;
		}

		const idx = valid.indexOf( tentative.rotation );
		const next = valid[ ( idx + 1 ) % valid.length ];
		if ( next === undefined ) {
			return;
		}

		setTentative( { ...tentative, rotation: next } );
	};

	const canDiscard = canPlace && activeDominoId !== null
		? getValidPlacements( params.board, activeDominoId ).length === 0
		: false;

	const handleDiscard = () => {
		if ( !canDiscard || !activeDominoId ) {
			return;
		}

		void discardDomino( { dominoId: activeDominoId } ).then( clear );
	};

	const getPreviewCoords = ( coord: Coord ) => {
		if ( !activeDominoId ) {
			return null;
		}

		const valid = getValidRotations( params.board, activeDominoId, coord );
		const first = valid[ 0 ];
		if ( first === undefined ) {
			return null;
		}

		return getPlacementCoordinates( { coord, rotation: first } );
	};

	const tentativeCoords = tentative ? getPlacementCoordinates( tentative ) : null;

	const tentativeProp = tentative && tentativeCoords ? {
		coords: tentativeCoords,
		anchor: tentative.coord,
		toolbar: (
			<div className={ "flex gap-1 items-center" }>
				<Button
					size={ "sm" }
					onClick={ handleCycleRotation }
					className={ "flex items-center gap-1" }
				>
					<RotateCwIcon className={ "w-4 h-4" }/>
					<span className={ "text-xs" }>{ tentative.rotation }°</span>
				</Button>
				<Button onClick={ handleConfirm } disabled={ isPending } className={ "w-8 h-8" }
								size={ "icon" }>
					<CheckIcon/>
				</Button>
				<Button onClick={ handleCancel } disabled={ isPending } className={ "w-8 h-8" }
								size={ "icon" }>
					<XIcon/>
				</Button>
			</div>
		),
		onClose: handleCancel
	} : undefined;

	return {
		handleCellClick,
		getPreviewCoords,
		canDiscard,
		handleDiscard,
		tentativeProp,
		isPending
	};
}
