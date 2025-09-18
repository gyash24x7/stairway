import { DisplayGame } from "@/fish/components/display-game";
import { StoreLoader } from "@/fish/components/store";
import { orpc } from "@/shared/utils/client";
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
