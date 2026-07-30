"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";

import type { TicTacToePlayerView, TicTacToeSnapshot } from "@/games/tictactoe/shared/schema.ts";
import { addBotsFn, placeFn } from "@/games/tictactoe/client/client.ts";

/** The snapshot as seen by the seated player — `view` narrowed to the required PlayerView. */
export type TicTacToePlayerSnapshot = Omit<TicTacToeSnapshot, "view"> & {
	view: TicTacToePlayerView
};

type TicTacToeContextValue = {
	data: TicTacToePlayerSnapshot;
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
	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "tic-tac-toe", "getState", gameId ]
	} );

	const place = useMutation( {
		mutationFn: ( position: number ) => placeFn( gameId, position ),
		onSuccess: invalidate
	} );

	const bots = useMutation( {
		mutationFn: () => addBotsFn( gameId ),
		onSuccess: invalidate
	} );

	// The SPA always plays as a seated player; the table/spectator view is not rendered.
	if ( data.view._tag !== "tictactoe/PlayerView" ) {
		return null;
	}

	const playerData: TicTacToePlayerSnapshot = { ...data, view: data.view };

	return (
		<TicTacToeContext value={ {
			data: playerData,
			placeMove: ( position: number ) => place.mutate( position ),
			addBots: () => bots.mutate(),
			isPending: place.isPending || bots.isPending
		} }>
			{ children }
		</TicTacToeContext>
	);
}
