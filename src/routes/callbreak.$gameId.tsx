import { CallbreakProvider } from "@/callbreak/components/context";
import { GameView } from "@/callbreak/components/game-view";
import { getGame } from "@/callbreak/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/callbreak/$gameId" )( {
	loader: ( { params } ) => getGame( { data: { gameId: params.gameId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<CallbreakProvider data={ data }>
				<GameView/>
			</CallbreakProvider>
		);
	}
} );
