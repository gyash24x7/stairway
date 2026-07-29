"use client";

import { useAuth } from "@s2h-ui/auth/use-auth";
import { toPlayerInfo } from "@s2h/contract/client";
import type { TicTacToeSnapshot } from "@s2h/schema/tictactoe";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { addBotsFn, placeFn } from "./client";

type TicTacToeContextValue = {
	data: TicTacToeSnapshot;
	placeMove: ( position: number ) => void;
	addBots: () => void;
	isPending: boolean;
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
	data: TicTacToeSnapshot;
	gameId: string;
	children: ReactNode;
};

export function TicTacToeProvider( { data, gameId, children }: TicTacToeProviderProps ) {
	const queryClient = useQueryClient();
	const { authInfo } = useAuth();

	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "tic-tac-toe", "getState", gameId ]
	} );

	const place = useMutation( {
		mutationFn: ( position: number ) =>
			placeFn( gameId, toPlayerInfo( authInfo! ), position ),
		onSuccess: invalidate
	} );

	const bots = useMutation( {
		mutationFn: () => addBotsFn( gameId ),
		onSuccess: invalidate
	} );

	return (
		<TicTacToeContext value={ {
			data,
			placeMove: ( position: number ) => place.mutate( position ),
			addBots: () => bots.mutate(),
			isPending: place.isPending || bots.isPending
		} }>
			{ children }
		</TicTacToeContext>
	);
}
