"use client";

import type { FishGame } from "@s2h/fish-core/types";
import { createContext, type ReactNode, useContext } from "react";

type FishContextValue = {
	shared: FishGame["shared"];
	player: FishGame["player"];
};

const FishContext = createContext<FishContextValue | null>( null );

export function useFish() {
	const ctx = useContext( FishContext );
	if ( !ctx ) {
		throw new Error( "useFish must be used within a FishProvider" );
	}
	return ctx;
}

type FishProviderProps = { data: FishGame; children: ReactNode; };

export function FishProvider( { data, children }: FishProviderProps ) {
	const { shared, player } = data;
	return (
		<FishContext value={ { shared, player } }>
			{ children }
		</FishContext>
	);
}
