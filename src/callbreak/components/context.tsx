"use client";

import type { CallbreakGame } from "@/callbreak/core/types";
import type { CardId } from "@/shared/utils/cards";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

type CallbreakContextValue = {
	shared: CallbreakGame["shared"];
	player: CallbreakGame["player"];
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
	const room = `callbreak:${ data.shared.id }`;
	const [ shared ] = useSyncedState( data.shared, "shared", room );
	const [ player ] = useSyncedState( data.player, data.player.playerId, room );
	const [ selectedCard, setSelectedCard ] = useState<CardId>();

	const isMyTurn = shared.status === "IN_PROGRESS" && shared.context.currentPlayer === player.playerId;

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
		<CallbreakContext value={ { shared, player, isMyTurn, selectCard, selectedCard } }>
			{ children }
		</CallbreakContext>
	);
}
