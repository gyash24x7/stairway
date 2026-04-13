import { FishProvider } from "@/fish/components/context";
import { GameView } from "@/fish/components/game-view";
import { getMatch } from "@/fish/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/fish/$matchId" )( {
	loader: ( { params } ) => getMatch( { data: { matchId: params.matchId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<FishProvider data={ data }>
				<GameView/>
			</FishProvider>
		);
	}
} );
