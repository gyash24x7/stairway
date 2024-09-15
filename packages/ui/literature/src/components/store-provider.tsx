"use client";

import { ReactNode, useRef } from "react";
import { StoreApi } from "zustand";
import { createGameStore, GameStore, GameStoreContext, RawGameData } from "../store";

export type GameStoreProviderProps = {
	gameData: RawGameData;
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