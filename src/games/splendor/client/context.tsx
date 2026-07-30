import type { SplendorPlayerView, SplendorSnapshot } from "@/games/splendor/shared/schema";
import { createContext, type ReactNode, useContext } from "react";

/** The snapshot as seen by the seated player — `view` narrowed to the required PlayerView. */
export type SplendorPlayerSnapshot = Omit<SplendorSnapshot, "view"> & { view: SplendorPlayerView };

type SplendorContextValue = {
	data: SplendorPlayerSnapshot
};

const SplendorContext = createContext<SplendorContextValue | null>( null );

export function useSplendor() {
	const ctx = useContext( SplendorContext );
	if ( !ctx ) {
		throw new Error( "useSplendor must be used within a SplendorProvider" );
	}
	return ctx;
}

type SplendorProviderProps = {
	data: SplendorSnapshot;
	children: ReactNode;
};

export function SplendorProvider( { data, children }: SplendorProviderProps ) {
	// The SPA always plays as a seated player; the table/spectator view is not rendered.
	if ( data.view._tag !== "splendor/PlayerView" ) {
		return null;
	}

	const playerData: SplendorPlayerSnapshot = { ...data, view: data.view };

	return (
		<SplendorContext value={ { data: playerData } }>
			{ children }
		</SplendorContext>
	);
}
