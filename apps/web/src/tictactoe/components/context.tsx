"use client";

import { orpc } from "@/api/query";
import type { BaseGameConfig, PlayerGameData, SharedGameData } from "@s2h/engine/types";
import type { TicTacToePlayerView, TicTacToeSharedView } from "@/tictactoe/core/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";

type TicTacToeData = {
	shared: SharedGameData<TicTacToeSharedView, BaseGameConfig>;
	player: PlayerGameData<TicTacToePlayerView>;
};

type TicTacToeContextValue = {
	shared: SharedGameData<TicTacToeSharedView, BaseGameConfig>;
	player: PlayerGameData<TicTacToePlayerView>;
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
	data: TicTacToeData;
	children: ReactNode;
};

export function TicTacToeProvider( { data, children }: TicTacToeProviderProps ) {
	const { shared, player } = data;
	const queryClient = useQueryClient();

	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: orpc.tictactoe.getGame.key( { input: { gameId: shared.id } } )
	} );

	const placeMoveMutation = useMutation( orpc.tictactoe.placeMove.mutationOptions( {
		onSuccess: invalidate
	} ) );

	const addBotsMutation = useMutation( orpc.tictactoe.addBots.mutationOptions( {
		onSuccess: invalidate
	} ) );

	const placeMove = ( position: number ) =>
		placeMoveMutation.mutate( { gameId: shared.id, position } );

	const addBots = () => addBotsMutation.mutate( { gameId: shared.id } );

	return (
		<TicTacToeContext value={ {
			shared,
			player,
			placeMove,
			addBots,
			isPending: placeMoveMutation.isPending || addBotsMutation.isPending
		} }>
			{ children }
		</TicTacToeContext>
	);
}
