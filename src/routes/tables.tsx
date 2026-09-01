import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { OpenTables } from "@/lobby/client/open-tables.tsx";

/**
 * The arena: every table waiting for players, whatever the game.
 *
 * Named `/tables` rather than `/lobby` because "lobby" is already spoken for in
 * this app — it is the pre-start seating screen inside a game, and one route
 * still sends people "BACK TO LOBBY" meaning that game's home page. A second,
 * different lobby would make both of those read wrong.
 *
 * Not behind a session guard, unlike a game page: somebody who has not signed in
 * should still be able to see that there is something to join, and be asked for
 * an account at the point it actually matters.
 */
export const Route = createFileRoute( "/tables" )( {
	component: OpenTablesRoute
} );

function OpenTablesRoute() {
	const { authInfo } = useAuth();
	return <OpenTables isLoggedIn={ !!authInfo }/>;
}
