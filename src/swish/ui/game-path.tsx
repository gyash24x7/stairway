import { createContext, useContext } from "react";


/**
 * Where a game's own pages are mounted: `""` for the classic routes
 * (`/tictactoe/:gameId`), `"/world"` when the same pages open as an overlay
 * inside the world (`/world/tictactoe/:gameId`).
 *
 * The shared chrome navigates between a game's pages — create sends you to the
 * table, join to the table, rematch to the next table, the lobby to an invite —
 * and every one of those hops has to stay on the surface it started on. A table
 * opened from the world that dropped you onto the classic page would close the
 * world, socket and all, mid-click.
 *
 * Only in-app navigation reads this. The invite link `GameInfo` copies and the
 * couch and controller links stay on the classic routes, because they are
 * opened by somebody else or on another screen, neither of which is standing in
 * your world.
 */
const GamePathContext = createContext( "" );

export const GamePathProvider = GamePathContext.Provider;

/** Builds a path to one of a game's pages on the surface it is being shown on. */
export function useGamePath() {
	const base = useContext( GamePathContext );
	return ( ...segments: ReadonlyArray<string> ) => `${ base }/${ segments.join( "/" ) }`;
}

export const useGameBasePath = () => useContext( GamePathContext );
