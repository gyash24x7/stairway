"use client";

import { useSync } from "@/shared/engine/hooks";
import type { SplendorMatch } from "@/splendor/core/types";
import { createContext, type ReactNode, useContext } from "react";

type SplendorContextValue = {
	match: SplendorMatch;
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

type SplendorProviderProps = { data: SplendorMatch; children: ReactNode; };

export function SplendorProvider( { data, children }: SplendorProviderProps ) {
	const match = useSync( "splendor", data.id, data );

	const isMyTurn = match.status === "IN_PROGRESS" && match.state.ctx.currentPlayer === match.state.data.playerId;

	return (
		<SplendorContext value={ { match, isMyTurn } }>
			{ children }
		</SplendorContext>
	);
}
