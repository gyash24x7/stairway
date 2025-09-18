import { orpc } from "@/shared/utils/client";
import { cn } from "@/shared/utils/cn";
import { DisplayGame } from "@/wordle/components/display-game";
import { StoreLoader } from "@/wordle/components/store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/wordle/$gameId" )( {
	loader: ( { context, params } ) => context.queryClient.ensureQueryData(
		orpc.wordle.getGameData.queryOptions( { input: { gameId: params.gameId } } )
	),
	component: () => {
		const data = Route.useLoaderData();
		return (
			<StoreLoader data={ data! }>
				<div className={ `flex flex-col items-center mb-20` }>
					<h1 className={ cn( "text-4xl my-3 font-heading" ) }>WORDLE</h1>
					<DisplayGame/>
				</div>
			</StoreLoader>
		);
	}
} );
