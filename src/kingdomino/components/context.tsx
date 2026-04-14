"use client";

import type { KingdominoMatch } from "@/kingdomino/core/types";
import { useSync } from "@/shared/engine/hooks";
import { createContext, type ReactNode, useContext } from "react";

type KingdominoContextValue = {
	match: KingdominoMatch;
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

type KingdominoProviderProps = { data: KingdominoMatch; children: ReactNode; };

export function KingdominoProvider( { data, children }: KingdominoProviderProps ) {
	const match = useSync( "kingdomino", data.id, data );
	const isMyTurn = match.status === "IN_PROGRESS" && match.state.ctx.currentPlayer === match.state.data.playerId;

	return (
		<KingdominoContext value={ { match, isMyTurn } }>
			{ children }
		</KingdominoContext>
	);
}
