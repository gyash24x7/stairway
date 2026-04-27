import { CallbreakProvider } from "@/callbreak/components/context";
import { GameView } from "@/callbreak/components/game-view";
import { getGame } from "@/callbreak/core/actions";

export async function CallbreakGamePage( { params }: { params: { gameId: string } } ) {
	const data = await getGame( { gameId: params.gameId } );
	return (
		<CallbreakProvider data={ data }>
			<GameView/>
		</CallbreakProvider>
	);
} 