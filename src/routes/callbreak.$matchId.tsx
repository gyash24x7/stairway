import { CallbreakProvider } from "@/callbreak/components/context";
import { GameView } from "@/callbreak/components/game-view";
import { getMatch } from "@/callbreak/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/callbreak/$matchId" )( {
	loader: ( { params } ) => getMatch( { data: { matchId: params.matchId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<CallbreakProvider data={ data }>
				<GameView/>
			</CallbreakProvider>
		);
	}
} );
