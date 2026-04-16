"use client";

import { useSync } from "@/shared/engine/hooks";
import type { SplendorGame } from "@/splendor/core/types";
import { createContext, type ReactNode, useContext } from "react";

type SplendorContextValue = {
	game: SplendorGame;
	isMyTurn: boolean;
};

const SplendorContext = createContext<SplendorContextValue | null>( null );

export function useSplendor() {
	const ctx = useContext( SplendorContext );
	if ( !ctx ) {
		throw new Error( "useSplendor must be used within a SplendorProvider" );
	}
	return ctx;
}

type SplendorProviderProps = { data: SplendorGame; children: ReactNode; };

export function SplendorProvider( { data, children }: SplendorProviderProps ) {
	const game = useSync( "splendor", data.id, data );

	const isMyTurn = game.status === "IN_PROGRESS" && game.context.currentPlayer === game.state.playerId;

	return (
		<SplendorContext value={ { game, isMyTurn } }>
			{ children }
		</SplendorContext>
	);
}
