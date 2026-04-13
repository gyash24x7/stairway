import { WordleProvider } from "@/wordle/components/context";
import { GameBoard } from "@/wordle/components/game-board";
import { getMatch } from "@/wordle/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/wordle/$matchId" )( {
	loader: ( { params } ) => getMatch( { data: { matchId: params.matchId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<WordleProvider data={ data }>
				<GameBoard/>
			</WordleProvider>
		);
	}
} );
