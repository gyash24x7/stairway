"use client";

import { useState } from "react";

import { useKingdomino } from "@/games/kingdomino/client/context.tsx";
import { usePlacement } from "@/games/kingdomino/client/use-placement.tsx";
import { createBoard } from "@/games/kingdomino/shared/utils.ts";

/**
 * Everything a seated player needs to take a Kingdomino turn: which of the two
 * phases they can act in, which domino is active, and the placement machinery.
 *
 * Lifted out of `game-view` so the full page and the couch-mode controller drive
 * the same logic instead of two copies that drift — the controller renders a
 * different layout, not different rules.
 *
 * Safe below the shared context even without a seat: `seated` is false there and
 * every affordance it gates is off, so a spectator screen mounting a component
 * that calls this gets a read-only one.
 */
export function useKingdominoTurn() {
	const { data, playerId, selectDomino, isSelectPending } = useKingdomino();
	const [ selectedDominoId, setSelectedDominoId ] = useState<number | null>( null );

	const seat = playerId ? data.view.playerData[ playerId ] : undefined;
	const info = playerId ? data.players[ playerId ] : undefined;
	const seated = !!playerId && !!seat && !!info;

	const isMyTurn = data.status === "IN_PROGRESS" && data.context.currentPlayer === playerId;

	// A placeholder kingdom for a screen with no seat, so the placement machinery
	// below stays unconditional — every affordance it drives is gated on `seated`.
	const board = seat?.board ?? createBoard( "red", data.config.boardSize );
	const queue = seat?.queue ?? [];

	const canSelect = seated && isMyTurn && data.context.phase === "SELECT" && !isSelectPending;

	// Deliberately not gated on `isMyTurn`: placement order is resolved from the
	// draft, so holding a queued domino is the affordance. The server is the
	// authority either way.
	const canPlace = seated
		&& data.status === "IN_PROGRESS"
		&& data.context.phase === "PLACE"
		&& queue.length > 0;

	const activeDomino = selectedDominoId
		?? ( canPlace ? queue.toSorted( ( a, b ) => a - b )[ 0 ] ?? null : null );

	const handleDominoSelect = ( dominoId: number ) => {
		if ( canSelect ) {
			selectDomino( { dominoId } );
		}
	};

	const placement = usePlacement( {
		board,
		activeDominoId: activeDomino,
		canPlace: canPlace && !isSelectPending,
		onClear: () => setSelectedDominoId( null )
	} );

	return {
		data,
		playerId,
		seated,
		seat,
		info,
		board,
		isMyTurn,
		canSelect,
		canPlace,
		activeDomino,
		isSelectPending,
		handleDominoSelect,
		placement
	};
}
