"use client";

import type { Tentative } from "@/kingdomino/components/board";
import { discardDomino, placeDomino } from "@/kingdomino/core/actions";
import type { Board, Coord, DominoId, Rotation } from "@/kingdomino/core/types";
import {
	getPlacementCoordinates,
	getValidPlacements,
	getValidRotations
} from "@/kingdomino/core/utils";
import { Button } from "@/shared/primitives/button";
import { CheckIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";

type UsePlacementParams = {
	gameId: string;
	board: Board;
	activeDominoId: DominoId | null;
	canPlace: boolean;
	onClear?: () => void;
};

type UsePlacementResult = {
	handleCellClick: ( coord: Coord ) => void;
	getPreviewCoords: ( coord: Coord ) => Coord[] | null;
	canDiscard: boolean;
	handleDiscard: () => void;
	tentativeProp: Tentative | undefined;
	isPending: boolean;
};

export function usePlacement( params: UsePlacementParams ): UsePlacementResult {
	const { gameId, board, activeDominoId, canPlace, onClear } = params;

	const [ tentative, setTentative ] = useState<{ coord: Coord; rotation: Rotation } | null>( null );
	const [ isPending, startTransition ] = useTransition();

	const handleCellClick = ( coord: Coord ) => {
		if ( !canPlace || !activeDominoId ) {
			return;
		}

		const valid = getValidRotations( board, activeDominoId, coord );
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

		const placement = { dominoId: activeDominoId, ...tentative };
		startTransition( async () => {
			await placeDomino( { gameId, placement } );
			setTentative( null );
			onClear?.();
		} );
	};

	const handleCancel = () => setTentative( null );

	const handleCycleRotation = () => {
		if ( !tentative || !activeDominoId ) {
			return;
		}

		const valid = getValidRotations( board, activeDominoId, tentative.coord );
		if ( valid.length === 0 ) {
			return;
		}
		const idx = valid.indexOf( tentative.rotation );
		const next = valid[ ( idx + 1 ) % valid.length ];
		setTentative( { ...tentative, rotation: next } );
	};

	const canDiscard = canPlace && activeDominoId !== null
		? getValidPlacements( board, activeDominoId ).length === 0
		: false;

	const handleDiscard = () => {
		if ( !canDiscard || !activeDominoId ) {
			return;
		}

		startTransition( async () => {
			await discardDomino( { gameId, dominoId: activeDominoId } );
			setTentative( null );
			onClear?.();
		} );
	};

	const getPreviewCoords = ( coord: Coord ): Coord[] | null => {
		if ( !activeDominoId ) {
			return null;
		}

		const valid = getValidRotations( board, activeDominoId, coord );
		if ( valid.length === 0 ) {
			return null;
		}

		return getPlacementCoordinates( { coord, rotation: valid[ 0 ] } );
	};

	const tentativeCoords = tentative ? getPlacementCoordinates( tentative ) : null;

	const tentativeProp: Tentative | undefined = tentative && tentativeCoords ? {
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
