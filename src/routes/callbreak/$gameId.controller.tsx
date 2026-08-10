import { createFileRoute } from "@tanstack/react-router";

import { CallbreakControllerPage } from "@/games/callbreak/client/index.ts";
import { RequireSession } from "@/shared/ui/components/require-session.tsx";

// No `fullBleed`: a phone wants the navbar (log out, theme, home).
export const Route = createFileRoute( "/callbreak/$gameId/controller" )( {
	component: ControllerRoute
} );

function ControllerRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<CallbreakControllerPage gameId={ gameId }/>
		</RequireSession>
	);
}
