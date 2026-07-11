"use client";

import type { SplendorGame } from "@s2h/splendor/types";
import { createContext, type ReactNode, useContext } from "react";

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
	const { shared, player } = data;
	return (
		<SplendorContext value={ { shared, player } }>
			{ children }
		</SplendorContext>
	);
}
