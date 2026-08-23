"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import type { ReactNode } from "react";

import { kingdominoApi } from "@/games/kingdomino/client/client.ts";

import type {
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoView,
	PlaceDominoInput,
	SelectDominoInput
} from "@/games/kingdomino/shared/schema.ts";
import type {
	GameId,
	GameRef,
	GameView,
	PlayerId,
	RematchInput
} from "@/swish/shared/schema.ts";

/**
 * One context for all three screens.
 *
 * Kingdomino hides nothing but the undrawn deck, so a seat's view and a
 * spectator's differ in `view.playerId` alone — every kingdom, every score and
 * the whole draft are public. `playerId` is therefore optional here and the
 * television simply never renders a control.
 */
type KingdominoContextValue = {
	data: GameView<KingdominoView, KingdominoConfig>;
	/** The viewing seat, absent on a shared screen. */
	playerId?: PlayerId;
	selectDomino: ( input: SelectDominoInput ) => void;
	placeDomino: ( input: PlaceDominoInput, onDone?: () => void ) => void;
	discardDomino: ( input: DiscardDominoInput, onDone?: () => void ) => void;
	addBots: () => void;
	startGame: () => void;
	setAutoPlay: ( enabled: boolean ) => void;
	isSelectPending: boolean;
	isPlacePending: boolean;
	startRematch: ( input: RematchInput, onDone: ( ref: GameRef ) => void ) => void;
	isPending: boolean;
};

const KingdominoContext = createContext<KingdominoContextValue | null>( null );

export function useKingdomino() {
	const ctx = useContext( KingdominoContext );
	if ( !ctx ) {
		throw new Error( "useKingdomino must be used within a KingdominoProvider" );
	}
	return ctx;
}

type KingdominoProviderProps = {
	data: GameView<KingdominoView, KingdominoConfig>;
	gameId: GameId;
	children: ReactNode;
};

export function KingdominoProvider( { data, gameId, children }: KingdominoProviderProps ) {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "kingdomino", "getState", gameId ]
	} );

	const select = useMutation( {
		mutationFn: ( input: SelectDominoInput ) => kingdominoApi.selectDomino( gameId, input ),
		onSuccess: invalidate
	} );

	const place = useMutation( {
		mutationFn: ( input: PlaceDominoInput ) => kingdominoApi.placeDomino( gameId, input ),
		onSuccess: invalidate
	} );

	const discard = useMutation( {
		mutationFn: ( input: DiscardDominoInput ) => kingdominoApi.discardDomino( gameId, input ),
		onSuccess: invalidate
	} );

	const bots = useMutation( {
		mutationFn: () => kingdominoApi.addBots( gameId ),
		onSuccess: invalidate
	} );

	const start = useMutation( {
		mutationFn: () => kingdominoApi.start( gameId ),
		onSuccess: invalidate
	} );

	const autoPlay = useMutation( {
		mutationFn: ( enabled: boolean ) => kingdominoApi.setAutoPlay( gameId, { enabled } ),
		onSuccess: invalidate
	} );

	// Invalidates the finished game, not the new one. The server pushes the new
	// ref onto every connected view over the socket, so this is the fallback for
	// a client whose socket is down: its own screen becomes the join state.
	const again = useMutation( {
		mutationFn: ( input: RematchInput ) => kingdominoApi.rematch( gameId, input ),
		onSuccess: invalidate
	} );

	return (
		<KingdominoContext value={ {
			data,
			playerId: data.view.playerId,
			selectDomino: input => select.mutate( input ),
			placeDomino: ( input, onDone ) => place.mutate( input, { onSuccess: onDone } ),
			discardDomino: ( input, onDone ) => discard.mutate( input, { onSuccess: onDone } ),
			addBots: () => bots.mutate(),
			startGame: () => start.mutate(),
			setAutoPlay: enabled => autoPlay.mutate( enabled ),
			isSelectPending: select.isPending,
			isPlacePending: place.isPending || discard.isPending,
			startRematch: ( input, onDone ) => again.mutate( input, { onSuccess: onDone } ),
			isPending: select.isPending
				|| place.isPending
				|| discard.isPending
				|| bots.isPending
				|| start.isPending
				|| autoPlay.isPending || again.isPending
		} }>
			{ children }
		</KingdominoContext>
	);
}
