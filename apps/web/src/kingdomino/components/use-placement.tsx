"use client";

import { orpc } from "@s2h/client/query";
import type { Tentative } from "@/kingdomino/components/board";
import type { Board, Coord, DominoId, Rotation } from "@s2h/kingdomino-core/types";
import {
	getPlacementCoordinates,
	getValidPlacements,
	getValidRotations
} from "@s2h/kingdomino-core/utils";
import { Button } from "@s2h/ui/primitives/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useState } from "react";

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

	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: orpc.kingdomino.getGame.key( { input: { gameId } } )
	} );

	const placeDomino = useMutation( orpc.kingdomino.placeDomino.mutationOptions( {
		onSuccess: invalidate
	} ) );
	const discardDomino = useMutation( orpc.kingdomino.discardDomino.mutationOptions( {
		onSuccess: invalidate
	} ) );

	const isPending = placeDomino.isPending || discardDomino.isPending;

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
		void ( async () => {
			await placeDomino.mutateAsync( { gameId, placement } );
			setTentative( null );
			onClear?.();
		} )();
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

		void ( async () => {
			await discardDomino.mutateAsync( { gameId, dominoId: activeDominoId } );
			setTentative( null );
			onClear?.();
		} )();
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
