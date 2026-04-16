"use client";

import { useSync } from "@/shared/engine/hooks";
import type { TicTacToeGame } from "@/tictactoe/core/types";
import { createContext, type ReactNode, useContext } from "react";

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
	const game = useSync( "tic-tac-toe", data.id, data );
	return (
		<TicTacToeContext value={ { game } }>
			{ children }
		</TicTacToeContext>
	);
}
