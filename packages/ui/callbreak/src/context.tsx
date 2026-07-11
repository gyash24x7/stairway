import type { CallbreakGame } from "@s2h/callbreak/types";
import { orpc } from "@s2h/client/query";
import type { CardId } from "@s2h/utils/cards";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

type CallbreakContextValue = {
	shared: CallbreakGame["shared"];
	player: CallbreakGame["player"];
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
		cardId: CardId
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

type CallbreakProviderProps = { data: CallbreakGame; children: ReactNode; };

export function CallbreakProvider( { data, children }: CallbreakProviderProps ) {
	const { shared, player } = data;
	const queryClient = useQueryClient();
	const [ selectedCard, setSelectedCard ] = useState<CardId>();

	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: orpc.callbreak.getGame.key( { input: { gameId: shared.id } } )
	} );

	const declareWins = useMutation( orpc.callbreak.declareWins.mutationOptions( {
		onSuccess: () => invalidate()
	} ) );

	const playCard = useMutation( orpc.callbreak.playCard.mutationOptions( {
		onSuccess: () => invalidate()
	} ) );

	const addBots = useMutation( orpc.callbreak.addBots.mutationOptions( {
		onSuccess: () => invalidate()
	} ) );

	const isMyTurn = shared.status === "IN_PROGRESS"
		&& shared.context.currentPlayer === player.playerId;

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
			shared,
			player,
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
