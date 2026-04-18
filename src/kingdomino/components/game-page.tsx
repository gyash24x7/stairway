import { KingdominoProvider } from "@/kingdomino/components/context";
import { GameView } from "@/kingdomino/components/game-view";
import { getGame } from "@/kingdomino/core/actions";

export async function KingdominoGamePage( { params }: { params: { gameId: string } } ) {
	const data = await getGame( { gameId: params.gameId } );
	return (
		<KingdominoProvider data={ data }>
			<GameView/>
		</KingdominoProvider>
	);
} 