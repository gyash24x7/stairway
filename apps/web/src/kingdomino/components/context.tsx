"use client";

import type { KingdominoGame } from "@/kingdomino/core/types";
import { createContext, type ReactNode, useContext } from "react";

type KingdominoContextValue = {
	shared: KingdominoGame["shared"];
	player: KingdominoGame["player"];
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
	const { shared, player } = data;
	return (
		<KingdominoContext value={ { shared, player } }>
			{ children }
		</KingdominoContext>
	);
}
