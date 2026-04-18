import { Board } from "@/wordle/components/board";
import { WordleProvider } from "@/wordle/components/context";
import { getGame } from "@/wordle/core/actions";

export async function WordleGamePage( { params }: { params: { gameId: string } } ) {
	const data = await getGame( { gameId: params.gameId } );
	return (
		<WordleProvider data={ data }>
			<Board/>
		</WordleProvider>
	);
}