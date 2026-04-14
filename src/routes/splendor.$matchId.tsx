import { SplendorProvider } from "@/splendor/components/context";
import { GameView } from "@/splendor/components/game-view";
import { getMatch } from "@/splendor/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/splendor/$matchId" )( {
	loader: ( { params } ) => getMatch( { data: { matchId: params.matchId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<SplendorProvider data={ data }>
				<GameView/>
			</SplendorProvider>
		);
	}
} );
