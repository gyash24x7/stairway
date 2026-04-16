"use client";

import type { KingdominoGame } from "@/kingdomino/core/types";
import { useSync } from "@/shared/engine/hooks";
import { createContext, type ReactNode, useContext } from "react";

type KingdominoContextValue = {
	game: KingdominoGame;
	isMyTurn: boolean;
};

const KingdominoContext = createContext<KingdominoContextValue | null>( null );

export function useKingdomino() {
	const ctx = useContext( KingdominoContext );
	if ( !ctx ) {
		throw new Error( "useKingdomino must be used within a KingdominoProvider" );
	}
	return ctx;
}

type KingdominoProviderProps = { data: KingdominoGame; children: ReactNode; };

export function KingdominoProvider( { data, children }: KingdominoProviderProps ) {
	const game = useSync( "kingdomino", data.id, data );
	const isMyTurn = game.status === "IN_PROGRESS" && game.context.currentPlayer === game.state.playerId;

	return (
		<KingdominoContext value={ { game, isMyTurn } }>
			{ children }
		</KingdominoContext>
	);
}
