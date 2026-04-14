"use client";

import type { CallbreakMatch } from "@/callbreak/core/types";
import { useSync } from "@/shared/engine/hooks";
import type { CardId } from "@/shared/utils/cards";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

type CallbreakContextValue = {
	match: CallbreakMatch;
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

type CallbreakProviderProps = { data: CallbreakMatch; children: ReactNode; };

export function CallbreakProvider( { data, children }: CallbreakProviderProps ) {
	const match = useSync( "callbreak", data.id, data );
	const [ selectedCard, setSelectedCard ] = useState<CardId>();

	const isMyTurn = match.status === "IN_PROGRESS" && match.state.ctx.currentPlayer === match.state.data.playerId;

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
		<CallbreakContext value={ { match, isMyTurn, selectCard, selectedCard } }>
			{ children }
		</CallbreakContext>
	);
}
