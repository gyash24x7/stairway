import { createFileRoute } from "@tanstack/react-router";

import { CoupCouchPage } from "@/games/coup/client/couch-page.tsx";

/**
 * The shared screen. `fullBleed` drops the app chrome — a navbar and centred
 * gutters are wasted space on a television across a room.
 */
export const Route = createFileRoute( "/coup/$gameId/couch" )( {
	component: CouchRoute,
	staticData: { fullBleed: true }
} );

function CouchRoute() {
	const { gameId } = Route.useParams();
	return <CoupCouchPage gameId={ gameId }/>;
}
