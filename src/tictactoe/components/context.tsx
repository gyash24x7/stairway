"use client";

import type { BaseGameConfig, PlayerGameData, SharedGameData } from "@/shared/engine/types";
import type { TicTacToePlayerView, TicTacToeSharedView } from "@/tictactoe/core/types";
import { createContext, type ReactNode, useContext } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

type TicTacToeContextValue = {
	shared: SharedGameData<TicTacToeSharedView, BaseGameConfig>;
	player: PlayerGameData<TicTacToePlayerView>;
};

const TicTacToeContext = createContext<TicTacToeContextValue | null>( null );

export function useTicTacToe() {
	const ctx = useContext( TicTacToeContext );
	if ( !ctx ) {
		throw new Error( "useTicTacToe must be used within a TicTacToeProvider" );
	}
	return ctx;
}

type TicTacToeProviderProps = {
	data: {
		shared: SharedGameData<TicTacToeSharedView, BaseGameConfig>;
		player: PlayerGameData<TicTacToePlayerView>
	};
	children: ReactNode;
};

export function TicTacToeProvider( { data, children }: TicTacToeProviderProps ) {
	const room = `tic-tac-toe:${ data.shared.id }`;
	const [ shared ] = useSyncedState( data.shared, "shared", room );
	const [ player ] = useSyncedState( data.player, data.player.playerId, room );
	return (
		<TicTacToeContext value={ { shared, player } }>
			{ children }
		</TicTacToeContext>
	);
}
