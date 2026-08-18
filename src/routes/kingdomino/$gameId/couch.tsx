import { createFileRoute } from "@tanstack/react-router";

import { KingdominoCouchPage } from "@/games/kingdomino/client/couch-page.tsx";

/**
 * The shared screen. `fullBleed` drops the app chrome — a navbar and centred
 * gutters are wasted space on a television across a room.
 */
export const Route = createFileRoute( "/kingdomino/$gameId/couch" )( {
	component: CouchRoute,
	staticData: { fullBleed: true }
} );

function CouchRoute() {
	const { gameId } = Route.useParams();
	return <KingdominoCouchPage gameId={ gameId }/>;
}
