import { useAuth } from "@s2h-ui/auth/use-auth";
import type { CardIdSchema } from "@s2h/callbreak/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import {
	addBotsFn,
	type CallbreakGame,
	declareWinsFn,
	playCardFn,
	toPlayerInfo
} from "./client";

type CardId = CallbreakGame[ "player" ][ "hand" ][ number ];

type CallbreakContextValue = {
	shared: CallbreakGame[ "shared" ];
	player: CallbreakGame[ "player" ];
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

type CallbreakProviderProps = { data: CallbreakGame; gameId: string; children: ReactNode; };

export function CallbreakProvider( { data, gameId, children }: CallbreakProviderProps ) {
	const { shared, player } = data;
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
