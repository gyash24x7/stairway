"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useState } from "react";

import type { ReactNode } from "react";

import { callbreakApi } from "@/games/callbreak/client/client.ts";

import type {
	CallbreakConfig,
	CallbreakView,
	DeclareWinsInput,
	PlayCardInput
} from "@/games/callbreak/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { GameId, GameView, PlayerId } from "@/swish/shared/schema.ts";

/**
 * One context for all three screens.
 *
 * The full page, the phone controller and the television all render the same
 * `GameView` — the wire carries exactly one envelope, and what differs between
 * an audience that holds a seat and one that doesn't is `view.playerId` and
 * whether `view.hand` has anything in it. So `playerId` is optional here and
 * everything seat-shaped is derived from it; a screen with no seat simply gets
 * `isMyTurn: false` and an empty hand, and the mutations it must not use are
 * never rendered.
 */
type CallbreakContextValue = {
	data: GameView<CallbreakView, CallbreakConfig>;
	/** The viewing seat, absent on a shared screen. */
	playerId?: PlayerId;
	isMyTurn: boolean;
	selectedCard?: CardId;
	selectCard: ( cardId: CardId ) => void;
	actions: {
		declareWins: ( input: DeclareWinsInput ) => void;
		playCard: ( input: PlayCardInput ) => void;
		addBots: () => void;
		startGame: () => void;
		setAutoPlay: ( enabled: boolean ) => void;
	};
	isPending: boolean;
};

const CallbreakContext = createContext<CallbreakContextValue | null>( null );

export function useCallbreak() {
	const ctx = useContext( CallbreakContext );
	if ( !ctx ) {
		throw new Error( "useCallbreak must be used within a CallbreakProvider" );
	}
	return ctx;
}

type CallbreakProviderProps = {
	data: GameView<CallbreakView, CallbreakConfig>;
	gameId: GameId;
	children: ReactNode;
};

export function CallbreakProvider( { data, gameId, children }: CallbreakProviderProps ) {
	const queryClient = useQueryClient();
	const [ selectedCard, setSelectedCard ] = useState<CardId>();

	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "callbreak", "getState", gameId ]
	} );

	const declare = useMutation( {
		mutationFn: ( input: DeclareWinsInput ) => callbreakApi.declareWins( gameId, input ),
		onSuccess: invalidate
	} );

	const play = useMutation( {
		mutationFn: ( input: PlayCardInput ) => callbreakApi.playCard( gameId, input ),
		onSuccess: () => {
			setSelectedCard( undefined );
			return invalidate();
		}
	} );

	const bots = useMutation( {
		mutationFn: () => callbreakApi.addBots( gameId ),
		onSuccess: invalidate
	} );

	const start = useMutation( {
		mutationFn: () => callbreakApi.start( gameId ),
		onSuccess: invalidate
	} );

	const autoPlay = useMutation( {
		mutationFn: ( enabled: boolean ) => callbreakApi.setAutoPlay( gameId, { enabled } ),
		onSuccess: invalidate
	} );

	const selectCard = useCallback( ( cardId: CardId ) => {
		setSelectedCard( current => current === cardId ? undefined : cardId );
	}, [] );

	const playerId = data.view.playerId;
	const isMyTurn = data.status === "IN_PROGRESS" && data.context.currentPlayer === playerId;

	return (
		<CallbreakContext value={ {
			data,
			playerId,
			isMyTurn,
			selectedCard,
			selectCard,
			actions: {
				declareWins: input => declare.mutate( input ),
				playCard: input => play.mutate( input ),
				addBots: () => bots.mutate(),
				startGame: () => start.mutate(),
				setAutoPlay: enabled => autoPlay.mutate( enabled )
			},
			isPending: declare.isPending
				|| play.isPending
				|| bots.isPending
				|| start.isPending
				|| autoPlay.isPending
		} }>
			{ children }
		</CallbreakContext>
	);
}
