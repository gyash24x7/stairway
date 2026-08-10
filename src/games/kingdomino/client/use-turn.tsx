"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { selectDominoFn } from "@/games/kingdomino/client/client.ts";
import { useKingdomino } from "@/games/kingdomino/client/context.tsx";
import { usePlacement } from "@/games/kingdomino/client/use-placement.tsx";

/**
 * Everything a seated player needs to take a Kingdomino turn: which of the two
 * phases they can act in, which domino is active, and the placement machinery.
 *
 * Lifted out of `game-view` so the full page and the couch-mode controller drive
 * the same logic instead of two copies that drift — the controller renders a
 * different layout, not different rules.
 */
export function useKingdominoTurn() {
	const { data } = useKingdomino();
	const player = data.view;

	const isMyTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === player.playerId;

	const myPlayerInfo = {
		...data.players[ player.playerId ],
		...data.view.playerData[ player.playerId ]
	};

	const queryClient = useQueryClient();
	const selectDomino = useMutation( {
		mutationFn: ( dominoId: number ) => selectDominoFn( data.id, { dominoId } ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "kingdomino", "getState", data.id ]
		} )
	} );

	const isSelectPending = selectDomino.isPending;
	const [ selectedDominoId, setSelectedDominoId ] = useState<number | null>( null );

	const canSelect = isMyTurn && data.context.phase === "SELECT" && !isSelectPending;

	// Deliberately not gated on `isMyTurn`: placement order is resolved from the
	// draft, so holding a queued domino is the affordance. The server is the
	// authority either way.
	const canPlace = data.status === "IN_PROGRESS"
		&& data.context.phase === "PLACE"
		&& myPlayerInfo.queue.length > 0;

	const activeDomino = selectedDominoId
		?? ( canPlace ? myPlayerInfo.queue.toSorted( ( a, b ) => a - b )[ 0 ] : null );

	const handleDominoSelect = ( dominoId: number ) => {
		if ( !canSelect ) {
			return;
		}
		selectDomino.mutate( dominoId );
	};

	const placement = usePlacement( {
		gameId: data.id,
		board: myPlayerInfo.board,
		activeDominoId: activeDomino,
		canPlace: canPlace && !isSelectPending,
		onClear: () => setSelectedDominoId( null )
	} );

	return {
		data,
		player,
		isMyTurn,
		myPlayerInfo,
		canSelect,
		canPlace,
		activeDomino,
		isSelectPending,
		handleDominoSelect,
		placement
	};
}
