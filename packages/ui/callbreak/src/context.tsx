import type { CallbreakSnapshot, DeclareWinsInput, PlayCardInput } from "@s2h/schema/callbreak";
import { CardId } from "@s2h/schema/cards";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { addBotsFn, declareWinsFn, playCardFn } from "./client";

type CallbreakContextValue = {
	data: CallbreakSnapshot;
	isMyTurn: boolean;
	selectedCard?: CardId;
	selectCard: ( cardId: CardId ) => void;
	declareWins: ReturnType<typeof useMutation<unknown, Error, DeclareWinsInput>>;
	playCard: ReturnType<typeof useMutation<unknown, Error, PlayCardInput>>;
	addBots: ReturnType<typeof useMutation<unknown, Error>>;
};

const CallbreakContext = createContext<CallbreakContextValue | null>( null );

export function useCallbreak() {
	const ctx = useContext( CallbreakContext );
	if ( !ctx ) {
		throw new Error( "useCallbreak must be used within a CallbreakProvider" );
	}
	return ctx;
}

type CallbreakProviderProps = { data: CallbreakSnapshot; gameId: string; children: ReactNode; };

export function CallbreakProvider( { data, gameId, children }: CallbreakProviderProps ) {
	const queryClient = useQueryClient();
	const [ selectedCard, setSelectedCard ] = useState<CardId>();

	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "callbreak", "getState", gameId ]
	} );

	const declareWins = useMutation( {
		mutationFn: ( input: DeclareWinsInput ) => declareWinsFn( gameId, input ),
		onSuccess: () => invalidate()
	} );

	const playCard = useMutation( {
		mutationFn: ( input: PlayCardInput ) => playCardFn( gameId, input ),
		onSuccess: () => invalidate()
	} );

	const addBots = useMutation( {
		mutationFn: () => addBotsFn( gameId ),
		onSuccess: () => invalidate()
	} );

	const isMyTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === data.view.playerId;

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
		<CallbreakContext value={ {
			data,
			isMyTurn,
			selectCard,
			selectedCard,
			declareWins,
			playCard,
			addBots
		} }>
			{ children }
		</CallbreakContext>
	);
}
