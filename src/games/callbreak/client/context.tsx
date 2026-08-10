import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

import type {
	CallbreakPlayerView,
	CallbreakSharedView,
	CallbreakSnapshot,
	CallbreakTableView,
	DeclareWinsInput,
	PlayCardInput
} from "@/games/callbreak/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import { addBotsFn, declareWinsFn, playCardFn } from "@/games/callbreak/client/client.ts";

/** The snapshot as seen by the seated player — `view` narrowed to the required PlayerView. */
export type CallbreakPlayerSnapshot = Omit<CallbreakSnapshot, "view"> & {
	view: CallbreakPlayerView
};

/** The snapshot as seen by the shared screen — `view` narrowed to the TableView. */
export type CallbreakTableSnapshot = Omit<CallbreakSnapshot, "view"> & {
	view: CallbreakTableView
};

/**
 * What *every* audience can see: scores, the public deal and the last completed
 * trick. Both view variants are structural supersets of `CallbreakSharedView` (the
 * player one adds `playerId` and `hand`), so either snapshot widens to this.
 *
 * Components reading this are safe on a television by construction — there is no
 * `hand` on it to leak.
 */
export type CallbreakBoardData = Omit<CallbreakSnapshot, "view"> & {
	view: CallbreakSharedView
};

type CallbreakContextValue = {
	data: CallbreakPlayerSnapshot;
	isMyTurn: boolean;
	selectedCard?: CardId;
	selectCard: ( cardId: CardId ) => void;
	declareWins: ReturnType<typeof useMutation<unknown, Error, DeclareWinsInput>>;
	playCard: ReturnType<typeof useMutation<unknown, Error, PlayCardInput>>;
	addBots: ReturnType<typeof useMutation<unknown, Error>>;
};

type CallbreakTableContextValue = {
	data: CallbreakTableSnapshot;
};

const CallbreakContext = createContext<CallbreakContextValue | null>( null );
const CallbreakTableContext = createContext<CallbreakTableContextValue | null>( null );
const CallbreakBoardContext = createContext<CallbreakBoardData | null>( null );

/** The seated player's snapshot, plus the mutations only a seat can make. */
export function useCallbreak() {
	const ctx = useContext( CallbreakContext );
	if ( !ctx ) {
		throw new Error( "useCallbreak must be used within a CallbreakProvider" );
	}
	return ctx;
}

/** The shared screen's snapshot. Carries no mutations — a television takes no turns. */
export function useCallbreakTable() {
	const ctx = useContext( CallbreakTableContext );
	if ( !ctx ) {
		throw new Error( "useCallbreakTable must be used within a CallbreakTableProvider" );
	}
	return ctx;
}

/** The public board, whichever audience is being rendered. Available below either provider. */
export function useCallbreakBoard() {
	const ctx = useContext( CallbreakBoardContext );
	if ( !ctx ) {
		throw new Error( "useCallbreakBoard must be used within a Callbreak provider" );
	}
	return { data: ctx };
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
			<CallbreakBoardContext value={ playerData }>
				{ children }
			</CallbreakBoardContext>
		</CallbreakContext>
	);
}

type CallbreakTableProviderProps = { data: CallbreakSnapshot; children: ReactNode };

/**
 * Provides the shared/couch snapshot, plus the board view beneath it. Deliberately
 * holds none of the player context's mutations or selection state: on a television
 * there is no seat to act as.
 */
export function CallbreakTableProvider( { data, children }: CallbreakTableProviderProps ) {
	if ( data.view._tag !== "callbreak/TableView" ) {
		return null;
	}

	const tableData: CallbreakTableSnapshot = { ...data, view: data.view };

	return (
		<CallbreakTableContext value={ { data: tableData } }>
			<CallbreakBoardContext value={ tableData }>
				{ children }
			</CallbreakBoardContext>
		</CallbreakTableContext>
	);
}
