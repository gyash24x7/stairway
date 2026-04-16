import { WordleProvider } from "@/wordle/components/context";
import { GameBoard } from "@/wordle/components/game-board";
import { getGame } from "@/wordle/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/wordle/$gameId" )( {
	loader: ( { params } ) => getGame( { data: { gameId: params.gameId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<WordleProvider data={ data }>
				<GameBoard/>
			</WordleProvider>
		);
	}
} );
