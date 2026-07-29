"use client";

import type { KingdominoSnapshot } from "@s2h/schema/kingdomino";
import { createContext, type ReactNode, useContext } from "react";


type KingdominoContextValue = {
	data: KingdominoSnapshot;
};

const KingdominoContext = createContext<KingdominoContextValue | null>( null );

export function useKingdomino() {
	const ctx = useContext( KingdominoContext );
	if ( !ctx ) {
		throw new Error( "useKingdomino must be used within a KingdominoProvider" );
	}
	return ctx;
}

type KingdominoProviderProps = { data: KingdominoSnapshot; children: ReactNode; };

export function KingdominoProvider( { data, children }: KingdominoProviderProps ) {
	return (
		<KingdominoContext value={ { data } }>
			{ children }
		</KingdominoContext>
	);
}
