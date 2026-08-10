import { createContext, type ReactNode, useContext } from "react";

import type {
	SplendorPlayerView,
	SplendorSharedView,
	SplendorSnapshot,
	SplendorTableView
} from "@/games/splendor/shared/schema.ts";

/** The snapshot as seen by the seated player — `view` narrowed to the required PlayerView. */
export type SplendorPlayerSnapshot = Omit<SplendorSnapshot, "view"> & { view: SplendorPlayerView };

/** The snapshot as seen by the shared screen — `view` narrowed to the TableView. */
export type SplendorTableSnapshot = Omit<SplendorSnapshot, "view"> & { view: SplendorTableView };

/**
 * What *every* audience can see: the envelope plus the public board fields.
 *
 * Both view variants are structural supersets of `SplendorSharedView` (the player
 * one only adds `playerId`), so either snapshot widens to this with no conversion.
 * Components that render the board read this and work unchanged on the phone and
 * on the television.
 */
export type SplendorBoardData = Omit<SplendorSnapshot, "view"> & { view: SplendorSharedView };

type SplendorContextValue = {
	data: SplendorPlayerSnapshot
};

type SplendorTableContextValue = {
	data: SplendorTableSnapshot
};

const SplendorContext = createContext<SplendorContextValue | null>( null );
const SplendorTableContext = createContext<SplendorTableContextValue | null>( null );
const SplendorBoardContext = createContext<SplendorBoardData | null>( null );

/** The seated player's snapshot. Only available below `SplendorProvider`. */
export function useSplendor() {
	const ctx = useContext( SplendorContext );
	if ( !ctx ) {
		throw new Error( "useSplendor must be used within a SplendorProvider" );
	}
	return ctx;
}

/** The shared screen's snapshot. Only available below `SplendorTableProvider`. */
export function useSplendorTable() {
	const ctx = useContext( SplendorTableContext );
	if ( !ctx ) {
		throw new Error( "useSplendorTable must be used within a SplendorTableProvider" );
	}
	return ctx;
}

/** The public board, whichever audience is being rendered. Available below either provider. */
export function useSplendorBoard() {
	const ctx = useContext( SplendorBoardContext );
	if ( !ctx ) {
		throw new Error( "useSplendorBoard must be used within a Splendor provider" );
	}
	return { data: ctx };
}

type SplendorProviderProps = {
	data: SplendorSnapshot;
	children: ReactNode;
};

/**
 * Provides the seated player's snapshot, plus the board view beneath it. The page
 * fetches through the member-gated `getState`, so a non-player view here is an
 * invariant violation rather than a state to render.
 */
export function SplendorProvider( { data, children }: SplendorProviderProps ) {
	if ( data.view._tag !== "splendor/PlayerView" ) {
		return null;
	}

	const playerData: SplendorPlayerSnapshot = { ...data, view: data.view };

	return (
		<SplendorContext value={ { data: playerData } }>
			<SplendorBoardContext value={ playerData }>
				{ children }
			</SplendorBoardContext>
		</SplendorContext>
	);
}

/**
 * Provides the shared/couch snapshot, plus the board view beneath it. Note it
 * carries no mutations: nothing on a television can take a turn.
 */
export function SplendorTableProvider( { data, children }: SplendorProviderProps ) {
	if ( data.view._tag !== "splendor/TableView" ) {
		return null;
	}

	const tableData: SplendorTableSnapshot = { ...data, view: data.view };

	return (
		<SplendorTableContext value={ { data: tableData } }>
			<SplendorBoardContext value={ tableData }>
				{ children }
			</SplendorBoardContext>
		</SplendorTableContext>
	);
}
