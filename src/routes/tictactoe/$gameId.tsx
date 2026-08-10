import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout for one game's screens. Owns nothing — not even the session gate, which
 * lives on each leaf because the couch screen needs its own TV-sized version of it.
 */
export const Route = createFileRoute( "/tictactoe/$gameId" )( {
	component: () => <Outlet/>
} );
