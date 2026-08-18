"use client";

import { CheckIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { useKingdomino } from "@/games/kingdomino/client/context.tsx";
import {
	getPlacementCoordinates,
	getValidPlacements,
	getValidRotations
} from "@/games/kingdomino/shared/utils.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";

import type { Board, Coord, Rotation } from "@/games/kingdomino/shared/schema.ts";

type UsePlacementParams = {
	board: Board;
	activeDominoId: number | null;
	canPlace: boolean;
	onClear?: () => void;
};

export function usePlacement( params: UsePlacementParams ) {
	const { activeDominoId, canPlace, onClear } = params;
	const { placeDomino, discardDomino, isPlacePending } = useKingdomino();
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
		if ( valid.length === 0 ) {
			return;
		}

		const initial = tentative && valid.includes( tentative.rotation )
			? tentative.rotation
			: valid[ 0 ];

		setTentative( { coord, rotation: initial } );
	};

	const handleConfirm = () => {
		if ( !tentative || !activeDominoId ) {
			return;
		}

		placeDomino( { placement: { dominoId: activeDominoId, ...tentative } }, clear );
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
		setTentative( { ...tentative, rotation: next } );
	};

	const canDiscard = canPlace && activeDominoId !== null
		? getValidPlacements( params.board, activeDominoId ).length === 0
		: false;

	const handleDiscard = () => {
		if ( !canDiscard || !activeDominoId ) {
			return;
		}

		discardDomino( { dominoId: activeDominoId }, clear );
	};

	const getPreviewCoords = ( coord: Coord ) => {
		if ( !activeDominoId ) {
			return null;
		}

		const valid = getValidRotations( params.board, activeDominoId, coord );
		if ( valid.length === 0 ) {
			return null;
		}

		return getPlacementCoordinates( { coord, rotation: valid[ 0 ] } );
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
				<Button onClick={ handleConfirm } disabled={ isPlacePending } className={ "w-8 h-8" }
								size={ "icon" }>
					<CheckIcon/>
				</Button>
				<Button onClick={ handleCancel } disabled={ isPlacePending } className={ "w-8 h-8" }
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
		isPending: isPlacePending
	};
}
