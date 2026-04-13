"use client";

import type { FishMatch } from "@/fish/core/types";
import { useSync } from "@/shared/engine/hooks";
import { createContext, type ReactNode, useContext } from "react";

type FishContextValue = {
	match: FishMatch;
	isMyTurn: boolean;
};

const FishContext = createContext<FishContextValue | null>( null );

export function useFish() {
	const ctx = useContext( FishContext );
	if ( !ctx ) {
		throw new Error( "useFish must be used within a FishProvider" );
	}
	return ctx;
}

type FishProviderProps = { data: FishMatch; children: ReactNode; };

export function FishProvider( { data, children }: FishProviderProps ) {
	const match = useSync( "fish", data.id, data );

	const isMyTurn = match.status === "IN_PROGRESS" && match.state.ctx.currentPlayer === match.state.data.playerId;

	return (
		<FishContext value={ { match, isMyTurn } }>
			{ children }
		</FishContext>
	);
}
