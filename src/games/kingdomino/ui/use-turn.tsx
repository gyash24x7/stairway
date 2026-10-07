import { useState } from "react";

import type {
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoView,
	PlaceDominoInput,
	SelectDominoInput
} from "@/games/kingdomino/schema";
import { usePlacement } from "@/games/kingdomino/ui/use-placement";
import { createBoard } from "@/games/kingdomino/utils";
import type { GameView, PlayerId } from "@/swish/schema";


type Game = GameView<KingdominoView, KingdominoConfig>;

type UseKingdominoTurnParams = {
	data: Game;
	playerId?: PlayerId;
	selectDomino: ( input: SelectDominoInput ) => Promise<unknown>;
	placeDomino: ( input: PlaceDominoInput ) => Promise<unknown>;
	discardDomino: ( input: DiscardDominoInput ) => Promise<unknown>;
	isSelectPending: boolean;
	isPlacePending: boolean;
};

/**
 * Everything a seated player needs to take a Kingdomino turn: which of the two
 * phases they can act in, which domino is active, and the placement machinery.
 *
 * Lifted out of `game-view` so the full page and the couch-mode controller drive
 * the same logic instead of two copies that drift — the controller renders a
 * different layout, not different rules.
 *
 * Safe even without a seat: `seated` is false there and every affordance it
 * gates is off, so a spectator screen calling this gets a read-only one.
 */
export function useKingdominoTurn( params: UseKingdominoTurnParams ) {
	const {
		data,
		playerId,
		selectDomino,
		placeDomino,
		discardDomino,
		isSelectPending,
		isPlacePending
	} = params;
	const [ selectedDominoId, setSelectedDominoId ] = useState<number | null>( null );

	const seat = playerId ? data.view.playerData[ playerId ] : undefined;
	const info = playerId ? data.players[ playerId ] : undefined;
	const seated = !!playerId && !!info;

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
			void selectDomino( { dominoId } );
		}
	};

	const placement = usePlacement( {
		board,
		activeDominoId: activeDomino,
		canPlace: canPlace && !isSelectPending,
		isPending: isPlacePending,
		placeDomino,
		discardDomino,
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
