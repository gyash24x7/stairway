import { FishProvider } from "@/fish/components/context";
import { GameView } from "@/fish/components/game-view";
import { getGame } from "@/fish/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/fish/$gameId" )( {
	loader: ( { params } ) => getGame( { data: { gameId: params.gameId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<FishProvider data={ data }>
				<GameView/>
			</FishProvider>
		);
	}
} );
