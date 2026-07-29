"use client";

import type { FishSnapshot } from "@s2h/schema/fish";
import { createContext, type ReactNode, useContext } from "react";

type FishContextValue = {
	data: FishSnapshot
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
	return (
		<FishContext value={ { data } }>
			{ children }
		</FishContext>
	);
}
