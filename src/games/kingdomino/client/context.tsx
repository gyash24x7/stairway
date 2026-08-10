"use client";

import { createContext, type ReactNode, useContext } from "react";

import type {
	KingdominoPlayerView,
	KingdominoSharedView,
	KingdominoSnapshot,
	KingdominoTableView
} from "@/games/kingdomino/shared/schema.ts";

/** The snapshot as seen by the seated player — `view` narrowed to the required PlayerView. */
export type KingdominoPlayerSnapshot = Omit<KingdominoSnapshot, "view"> & { view: KingdominoPlayerView };

/** The snapshot as seen by the shared screen — `view` narrowed to the TableView. */
export type KingdominoTableSnapshot = Omit<KingdominoSnapshot, "view"> & { view: KingdominoTableView };

/**
 * What *every* audience can see: the envelope plus the public board fields.
 *
 * Kingdomino hides only the undrawn `deck`, so both view variants are structural
 * supersets of `KingdominoSharedView` (the player one only adds `playerId`) and
 * either snapshot widens to this with no conversion. Components that render
 * kingdoms, scores or the draft read this and work unchanged on the phone and on
 * the television.
 */
export type KingdominoBoardData = Omit<KingdominoSnapshot, "view"> & { view: KingdominoSharedView };

type KingdominoContextValue = {
	data: KingdominoPlayerSnapshot;
};

type KingdominoTableContextValue = {
	data: KingdominoTableSnapshot;
};

const KingdominoContext = createContext<KingdominoContextValue | null>( null );
const KingdominoTableContext = createContext<KingdominoTableContextValue | null>( null );
const KingdominoBoardContext = createContext<KingdominoBoardData | null>( null );

/** The seated player's snapshot. Only available below `KingdominoProvider`. */
export function useKingdomino() {
	const ctx = useContext( KingdominoContext );
	if ( !ctx ) {
		throw new Error( "useKingdomino must be used within a KingdominoProvider" );
	}
	return ctx;
}

/** The shared screen's snapshot. Only available below `KingdominoTableProvider`. */
export function useKingdominoTable() {
	const ctx = useContext( KingdominoTableContext );
	if ( !ctx ) {
		throw new Error( "useKingdominoTable must be used within a KingdominoTableProvider" );
	}
	return ctx;
}

/** The public board, whichever audience is being rendered. Available below either provider. */
export function useKingdominoBoard() {
	const ctx = useContext( KingdominoBoardContext );
	if ( !ctx ) {
		throw new Error( "useKingdominoBoard must be used within a Kingdomino provider" );
	}
	return { data: ctx };
}

type KingdominoProviderProps = { data: KingdominoSnapshot; children: ReactNode; };

/**
 * Provides the seated player's snapshot, plus the board view beneath it. The page
 * fetches through the member-gated `getState`, so a non-player view here is an
 * invariant violation rather than a state to render.
 */
export function KingdominoProvider( { data, children }: KingdominoProviderProps ) {
	if ( data.view._tag !== "kingdomino/PlayerView" ) {
		return null;
	}

	const playerData: KingdominoPlayerSnapshot = { ...data, view: data.view };

	return (
		<KingdominoContext value={ { data: playerData } }>
			<KingdominoBoardContext value={ playerData }>
				{ children }
			</KingdominoBoardContext>
		</KingdominoContext>
	);
}

/**
 * Provides the shared/couch snapshot, plus the board view beneath it. Note it
 * carries no mutations: nothing on a television can take a turn.
 */
export function KingdominoTableProvider( { data, children }: KingdominoProviderProps ) {
	if ( data.view._tag !== "kingdomino/TableView" ) {
		return null;
	}

	const tableData: KingdominoTableSnapshot = { ...data, view: data.view };

	return (
		<KingdominoTableContext value={ { data: tableData } }>
			<KingdominoBoardContext value={ tableData }>
				{ children }
			</KingdominoBoardContext>
		</KingdominoTableContext>
	);
}
