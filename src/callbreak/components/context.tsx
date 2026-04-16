"use client";

import type { CallbreakGame } from "@/callbreak/core/types";
import { useSync } from "@/shared/engine/hooks";
import type { CardId } from "@/shared/utils/cards";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

type CallbreakContextValue = {
	game: CallbreakGame;
	isMyTurn: boolean;
	selectedCard?: CardId;
	selectCard: ( cardId: CardId ) => void;
};

const CallbreakContext = createContext<CallbreakContextValue | null>( null );

export function useCallbreak() {
	const ctx = useContext( CallbreakContext );
	if ( !ctx ) {
		throw new Error( "useCallbreak must be used within a CallbreakProvider" );
	}
	return ctx;
}

type CallbreakProviderProps = { data: CallbreakGame; children: ReactNode; };

export function CallbreakProvider( { data, children }: CallbreakProviderProps ) {
	const game = useSync( "callbreak", data.id, data );
	const [ selectedCard, setSelectedCard ] = useState<CardId>();

	const isMyTurn = game.status === "IN_PROGRESS" && game.context.currentPlayer === game.state.playerId;

	const selectCard = useCallback(
		( cardId: CardId ) => {
			if ( cardId === selectedCard ) {
				setSelectedCard( undefined );
			} else {
				setSelectedCard( cardId );
			}
		},
		[ selectedCard ]
	);

	return (
		<CallbreakContext value={ { game, isMyTurn, selectCard, selectedCard } }>
			{ children }
		</CallbreakContext>
	);
}
