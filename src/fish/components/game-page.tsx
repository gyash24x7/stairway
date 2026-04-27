import { FishProvider } from "@/fish/components/context";
import { GameView } from "@/fish/components/game-view";
import { getGame } from "@/fish/core/actions";

export async function FishGamePage( { params }: { params: { gameId: string } } ) {
	const data = await getGame( { gameId: params.gameId } );
	return (
		<FishProvider data={ data }>
			<GameView/>
		</FishProvider>
	);
} 