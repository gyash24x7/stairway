"use client";

import { useAuth } from "@s2h-ui/auth/use-auth";
import { toPlayerInfo } from "@s2h/contract/client";
import type { TicTacToePlayerView, TicTacToeSnapshot } from "@s2h/schema/tictactoe";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { addBotsFn, placeFn } from "./client";

/** The snapshot as seen by the seated player — `view` narrowed to the required PlayerView. */
export type TicTacToePlayerSnapshot = Omit<TicTacToeSnapshot, "view"> & { view: TicTacToePlayerView };

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
