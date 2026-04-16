"use client";

import type { FishGame } from "@/fish/core/types";
import { useSync } from "@/shared/engine/hooks";
import { createContext, type ReactNode, useContext } from "react";

type FishContextValue = {
	game: FishGame;
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

type FishProviderProps = { data: FishGame; children: ReactNode; };

export function FishProvider( { data, children }: FishProviderProps ) {
	const game = useSync( "fish", data.id, data );

	const isMyTurn = game.status === "IN_PROGRESS" && game.context.currentPlayer === game.state.playerId;

	return (
		<FishContext value={ { game, isMyTurn } }>
			{ children }
		</FishContext>
	);
}
