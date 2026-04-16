import { KingdominoProvider } from "@/kingdomino/components/context";
import { GameView } from "@/kingdomino/components/game-view";
import { getGame } from "@/kingdomino/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/kingdomino/$gameId" )( {
	loader: ( { params } ) => getGame( { data: { gameId: params.gameId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<KingdominoProvider data={ data }>
				<GameView/>
			</KingdominoProvider>
		);
	}
} );
