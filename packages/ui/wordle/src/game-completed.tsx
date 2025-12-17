import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import { useGetWordsQuery } from "@s2h/client/wordle";
import { Link } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { GuessDiagramBlocks } from "./guess-blocks.tsx";
import { store } from "./store.tsx";

export function GameCompleted() {
	const gameId = useStore( store, state => state.game.id );
	const { data, isPending } = useGetWordsQuery( gameId );

	if ( isPending || !data ) {
		return <Spinner/>;
	}

	return (
		<div className={ "flex flex-col gap-12 items-center w-full" }>
			<h1 className={ "text-4xl font-fjalla text-green-600" }>Game Completed</h1>
			<GuessDiagramBlocks words={ data.words }/>
			<div
				className={ cn(
					"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
					"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center bg-main"
				) }
			>
				<Link to={ "/wordle" }>
					<h2>TRY AGAIN?</h2>
				</Link>
			</div>
		</div>
	);
}