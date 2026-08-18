import { createFileRoute } from "@tanstack/react-router";

import { SplendorCouchPage } from "@/games/splendor/client/couch-page.tsx";

/**
 * The shared screen. `fullBleed` drops the app chrome — a navbar and centred
 * gutters are wasted space on a television across a room.
 */
export const Route = createFileRoute( "/splendor/$gameId/couch" )( {
	component: CouchRoute,
	staticData: { fullBleed: true }
} );

function CouchRoute() {
	const { gameId } = Route.useParams();
	return <SplendorCouchPage gameId={ gameId }/>;
}
