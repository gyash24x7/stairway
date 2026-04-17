import { WordleProvider } from "@/wordle/components/context";
import { GameBoard } from "@/wordle/components/game-board";
import { getGame } from "@/wordle/core/actions";

export async function WordleGamePage( { params }: { params: { gameId: string } } ) {
	const data = await getGame( { gameId: params.gameId } );
	return (
		<WordleProvider data={ data }>
			<GameBoard/>
		</WordleProvider>
	);
}