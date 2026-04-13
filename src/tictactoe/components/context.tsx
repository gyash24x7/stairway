"use client";

import { useSync } from "@/shared/engine/hooks";
import type { TicTacToeMatch } from "@/tictactoe/core/types";
import { createContext, type ReactNode, useContext } from "react";

type TicTacToeContextValue = {
	match: TicTacToeMatch;
};

const TicTacToeContext = createContext<TicTacToeContextValue | null>( null );

export function useTicTacToe() {
	const ctx = useContext( TicTacToeContext );
	if ( !ctx ) {
		throw new Error( "useTicTacToe must be used within a TicTacToeProvider" );
	}
	return ctx;
}

type TicTacToeProviderProps = { data: TicTacToeMatch; children: ReactNode; };

export function TicTacToeProvider( { data, children }: TicTacToeProviderProps ) {
	const match = useSync( "tic-tac-toe", data.id, data );
	return (
		<TicTacToeContext value={ { match } }>
			{ children }
		</TicTacToeContext>
	);
}
