"use client";

import type { TicTacToeGame } from "@/tictactoe/core/types";
import { createContext, type ReactNode, useContext } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

type TicTacToeContextValue = {
	game: TicTacToeGame;
};

const TicTacToeContext = createContext<TicTacToeContextValue | null>( null );

export function useTicTacToe() {
	const ctx = useContext( TicTacToeContext );
	if ( !ctx ) {
		throw new Error( "useTicTacToe must be used within a TicTacToeProvider" );
	}
	return ctx;
}

type TicTacToeProviderProps = { data: TicTacToeGame; children: ReactNode; };

export function TicTacToeProvider( { data, children }: TicTacToeProviderProps ) {
	const [ game ] = useSyncedState( data, data.id, "tic-tac-toe" );
	return (
		<TicTacToeContext value={ { game } }>
			{ children }
		</TicTacToeContext>
	);
}
