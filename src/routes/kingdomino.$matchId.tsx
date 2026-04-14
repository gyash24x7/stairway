import { KingdominoProvider } from "@/kingdomino/components/context";
import { GameView } from "@/kingdomino/components/game-view";
import { getMatch } from "@/kingdomino/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/kingdomino/$matchId" )( {
	loader: ( { params } ) => getMatch( { data: { matchId: params.matchId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<KingdominoProvider data={ data }>
				<GameView/>
			</KingdominoProvider>
		);
	}
} );
