import { createFileRoute } from "@tanstack/react-router";

import { SplendorCouchPage } from "@/games/splendor/client/index.ts";
import { RequireSession } from "@/shared/ui/components/require-session.tsx";
import { CouchSignedOut } from "@/shared/ui/couch/couch-shell.tsx";

export const Route = createFileRoute( "/splendor/$gameId/couch" )( {
	component: CouchRoute,
	// A television wants the whole viewport — no navbar, no page gutters.
	staticData: { fullBleed: true }
} );

function CouchRoute() {
	const { gameId } = Route.useParams();

	// Any valid session will do: the shared board carries no private slice, so the
	// screen showing it need not hold a seat.
	return (
		<RequireSession fallback={ <CouchSignedOut/> }>
			<SplendorCouchPage gameId={ gameId }/>
		</RequireSession>
	);
}
