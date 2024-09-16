"use client";

import type { Game } from "@wordle/api";
import { type ReactNode, useRef } from "react";
import type { StoreApi } from "zustand";
import { createGameStore, GameStore, GameStoreContext } from "../store";

export type GameStoreProviderProps = {
	gameData: Game;
	children: ReactNode;
}

export const GameStoreProvider = ( props: GameStoreProviderProps ) => {
	const storeRef = useRef<StoreApi<GameStore>>();
	if ( !storeRef.current ) {
		storeRef.current = createGameStore( props.gameData );
	}

	return (
		<GameStoreContext.Provider value={ storeRef.current }>
			{ props.children }
		</GameStoreContext.Provider>
	);
};