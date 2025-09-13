import { orpc } from "@/app/client/orpc";
import { DisplayGame } from "@/app/components/fish/display-game";
import { StoreLoader } from "@/app/components/fish/store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/fish/$gameId" )( {
	loader: ( { context, params } ) => context.queryClient.ensureQueryData(
		orpc.fish.getGameData.queryOptions( { input: { gameId: params.gameId } } )
	),
	component: () => {
		const data = Route.useLoaderData();
		return (
			<StoreLoader data={ data! }>
				<DisplayGame/>
			</StoreLoader>
		);
	}
} );
