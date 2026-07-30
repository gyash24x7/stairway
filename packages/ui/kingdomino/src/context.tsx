"use client";

import type { KingdominoPlayerView, KingdominoSnapshot } from "@s2h/schema/kingdomino";
import { createContext, type ReactNode, useContext } from "react";

/** The snapshot as seen by the seated player — `view` narrowed to the required PlayerView. */
export type KingdominoPlayerSnapshot = Omit<KingdominoSnapshot, "view"> & { view: KingdominoPlayerView };

type KingdominoContextValue = {
	data: KingdominoPlayerSnapshot;
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
	// The SPA always plays as a seated player; the table/spectator view is not rendered.
	if ( data.view._tag !== "kingdomino/PlayerView" ) {
		return null;
	}

	const playerData: KingdominoPlayerSnapshot = { ...data, view: data.view };

	return (
		<KingdominoContext value={ { data: playerData } }>
			{ children }
		</KingdominoContext>
	);
}
