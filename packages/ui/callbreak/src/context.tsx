import { useAuth } from "@s2h-ui/auth/use-auth";
import { toPlayerInfo } from "@s2h/contract/client";
import type { CallbreakSnapshot, CardIdSchema } from "@s2h/schema/callbreak";
import type { CardId } from "@s2h/utils/cards";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { addBotsFn, declareWinsFn, playCardFn } from "./client";


type CallbreakContextValue = {
	data: CallbreakSnapshot;
	isMyTurn: boolean;
	selectedCard?: CardId;
	selectCard: ( cardId: CardId ) => void;
	declareWins: ReturnType<typeof useMutation<unknown, Error, {
		gameId: string;
		dealId: string;
		wins: number
	}>>;
	playCard: ReturnType<typeof useMutation<unknown, Error, {
		gameId: string;
		dealId: string;
		cardId: CardIdSchema
	}>>;
	addBots: ReturnType<typeof useMutation<unknown, Error, { gameId: string }>>;
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
	const { authInfo } = useAuth();
	const [ selectedCard, setSelectedCard ] = useState<CardId>();

	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "callbreak", "getState", gameId ]
	} );

	const declareWins = useMutation( {
		mutationFn: ( { dealId, wins }: { gameId: string; dealId: string; wins: number } ) =>
			declareWinsFn( gameId, toPlayerInfo( authInfo! ), { wins, dealId } ),
		onSuccess: () => invalidate()
	} );

	const playCard = useMutation( {
		mutationFn: ( { dealId, cardId }: { gameId: string; dealId: string; cardId: CardIdSchema } ) =>
			playCardFn( gameId, toPlayerInfo( authInfo! ), { cardId, dealId } ),
		onSuccess: () => invalidate()
	} );

	const addBots = useMutation( {
		mutationFn: ( _vars: { gameId: string } ) => addBotsFn( gameId ),
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
