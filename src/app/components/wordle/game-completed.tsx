import { orpc } from "@/app/client/orpc";
import { GuessDiagramBlocks } from "@/app/components/wordle/guess-blocks";
import { store } from "@/app/components/wordle/store";
import { Spinner } from "@/app/primitives/spinner";
import { cn } from "@/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";

export function GameCompleted() {
	const gameId = useStore( store, state => state.game.id );
	const { data, isPending } = useQuery( orpc.wordle.getWords.queryOptions( { input: { gameId } } ) );

	if ( isPending || !data ) {
		return <Spinner/>;
	}

	return (
		<div className={ "flex flex-col gap-12 items-center w-full" }>
			<h1 className={ "text-4xl font-fjalla text-green-600" }>Game Completed</h1>
			<GuessDiagramBlocks words={ data }/>
			<div
				className={ cn(
					"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
					"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center bg-main"
				) }
			>
				<a href={ "/core" }>
					<h2>TRY AGAIN?</h2>
				</a>
			</div>
		</div>
	);
}