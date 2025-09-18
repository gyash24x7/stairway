import { DisplayGame } from "@/callbreak/components/display-game";
import { StoreLoader } from "@/callbreak/components/store";
import { orpc } from "@/shared/utils/client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/callbreak/$gameId" )( {
	loader: ( { context, params } ) => context.queryClient.ensureQueryData(
		orpc.callbreak.getGameData.queryOptions( { input: { gameId: params.gameId } } )
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
