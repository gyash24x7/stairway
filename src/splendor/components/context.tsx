"use client";

import type { SplendorGame } from "@/splendor/core/types";
import { createContext, type ReactNode, useContext } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

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
	const [ game ] = useSyncedState( data, data.id, "splendor" );

	const isMyTurn = game.status === "IN_PROGRESS" && game.context.currentPlayer === game.state.playerId;

	return (
		<SplendorContext value={ { game, isMyTurn } }>
			{ children }
		</SplendorContext>
	);
}
