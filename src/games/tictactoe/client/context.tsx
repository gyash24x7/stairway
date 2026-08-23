"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import type { ReactNode } from "react";

import { tictactoeApi } from "@/games/tictactoe/client/client.ts";
import { TicTacToeConfig, TicTacToeSeatView } from "@/games/tictactoe/shared/schema.ts";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { GameView } from "@/swish/shared/schema.ts";

import type { TicTacToeView } from "@/games/tictactoe/shared/schema.ts";
import type { GameId, GameRef, RematchInput } from "@/swish/shared/schema.ts";


type TicTacToeContextValue = {
	data: GameView<TicTacToeSeatView, TicTacToeConfig>;
	placeMove: ( position: number ) => void;
	addBots: () => void;
	startGame: () => void;
	startRematch: ( input: RematchInput, onDone: ( ref: GameRef ) => void ) => void;
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
	data: GameView<TicTacToeView, TicTacToeConfig>;
	gameId: GameId;
	children: ReactNode;
};

export function TicTacToeProvider( { data, gameId, children }: TicTacToeProviderProps ) {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "tictactoe", "getState", gameId ]
	} );

	const place = useMutation( {
		mutationFn: ( position: number ) => tictactoeApi.place( gameId, { position } ),
		onSuccess: invalidate
	} );

	const bots = useMutation( {
		mutationFn: () => tictactoeApi.addBots( gameId ),
		onSuccess: invalidate
	} );

	const start = useMutation( {
		mutationFn: () => tictactoeApi.start( gameId ),
		onSuccess: invalidate
	} );

	// Invalidates the finished game, not the new one. The server pushes the new
	// ref onto every connected view over the socket, so this is the fallback for
	// a client whose socket is down: its own screen becomes the join state.
	const again = useMutation( {
		mutationFn: ( input: RematchInput ) => tictactoeApi.rematch( gameId, input ),
		onSuccess: invalidate
	} );

	if ( !data.view.playerId ) {
		// A screen holding no seat — a spectator, or a stale link. These three games
		// have only a seat's screen to offer, so say so rather than rendering blank.
		return (
			<ErrorState
				title={ "You don't have a seat in this game" }
				message={ "This game is already under way, and only its players can watch it." }
				action={ { label: "BACK TO LOBBY", to: "/tictactoe" } }
			/>
		);
	}

	const playerData = GameView( TicTacToeSeatView, TicTacToeConfig )
		.make( { ...data, view: { ...data.view, playerId: data.view.playerId } } );

	return (
		<TicTacToeContext value={ {
			data: playerData,
			placeMove: ( position: number ) => place.mutate( position ),
			addBots: () => bots.mutate(),
			startGame: () => start.mutate(),
			startRematch: ( input, onDone ) => again.mutate( input, { onSuccess: onDone } ),
			isPending: place.isPending || bots.isPending || start.isPending || again.isPending
		} }>
			{ children }
		</TicTacToeContext>
	);
}
