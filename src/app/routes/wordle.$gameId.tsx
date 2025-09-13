import { orpc } from "@/app/client/orpc";
import { DisplayGame } from "@/app/components/wordle/display-game";
import { StoreLoader } from "@/app/components/wordle/store";
import { cn } from "@/utils/cn";
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
