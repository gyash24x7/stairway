import type {
	CallbreakPlayerView,
	CallbreakSnapshot,
	DeclareWinsInput,
	PlayCardInput
} from "@/games/callbreak/shared/schema";
import { CardId } from "@/schema/cards";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { addBotsFn, declareWinsFn, playCardFn } from "./client";

/** The snapshot as seen by the seated player — `view` narrowed to the required PlayerView. */
export type CallbreakPlayerSnapshot = Omit<CallbreakSnapshot, "view"> & { view: CallbreakPlayerView };

type CallbreakContextValue = {
	data: CallbreakPlayerSnapshot;
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

	// The SPA always plays as a seated player; the table/spectator view is not rendered.
	if ( data.view._tag !== "callbreak/PlayerView" ) {
		return null;
	}

	const playerData: CallbreakPlayerSnapshot = { ...data, view: data.view };

	const isMyTurn = playerData.status === "IN_PROGRESS"
		&& playerData.context.currentPlayer === playerData.view.playerId;

	return (
		<CallbreakContext value={ {
			data: playerData,
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
