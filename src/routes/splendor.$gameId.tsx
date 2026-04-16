import { SplendorProvider } from "@/splendor/components/context";
import { GameView } from "@/splendor/components/game-view";
import { getGame } from "@/splendor/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/splendor/$gameId" )( {
	loader: ( { params } ) => getGame( { data: { gameId: params.gameId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<SplendorProvider data={ data }>
				<GameView/>
			</SplendorProvider>
		);
	}
} );
