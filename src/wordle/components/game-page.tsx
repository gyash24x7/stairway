import { WordleProvider } from "@/wordle/components/context";
import { GameView } from "@/wordle/components/game-view";
import { getGame } from "@/wordle/core/actions";

export async function WordleGamePage( { params }: { params: { gameId: string } } ) {
	const data = await getGame( { gameId: params.gameId } );
	return (
		<WordleProvider data={ data }>
			<GameView/>
		</WordleProvider>
	);
}