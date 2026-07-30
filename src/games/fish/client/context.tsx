"use client";

import type { FishPlayerView, FishSnapshot } from "@/games/fish/shared/schema";
import { createContext, type ReactNode, useContext } from "react";

/** The snapshot as seen by the seated player — `view` narrowed to the required PlayerView. */
export type FishPlayerSnapshot = Omit<FishSnapshot, "view"> & { view: FishPlayerView };

type FishContextValue = {
	data: FishPlayerSnapshot
};

const FishContext = createContext<FishContextValue | null>( null );

export function useFish() {
	const ctx = useContext( FishContext );
	if ( !ctx ) {
		throw new Error( "useFish must be used within a FishProvider" );
	}
	return ctx;
}

type FishProviderProps = { data: FishSnapshot; children: ReactNode; };

export function FishProvider( { data, children }: FishProviderProps ) {
	// The SPA always plays as a seated player; the table/spectator view is not rendered.
	if ( data.view._tag !== "fish/PlayerView" ) {
		return null;
	}

	const playerData: FishPlayerSnapshot = { ...data, view: data.view };

	return (
		<FishContext value={ { data: playerData } }>
			{ children }
		</FishContext>
	);
}
