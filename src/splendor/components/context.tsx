"use client";

import type { SplendorGame } from "@/splendor/core/types";
import { createContext, type ReactNode, useContext } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

type SplendorContextValue = {
	shared: SplendorGame["shared"];
	player: SplendorGame["player"];
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
	const room = `splendor:${ data.shared.id }`;
	const [ shared ] = useSyncedState( data.shared, "shared", room );
	const [ player ] = useSyncedState( data.player, data.player.playerId, room );
	return (
		<SplendorContext value={ { shared, player } }>
			{ children }
		</SplendorContext>
	);
}
