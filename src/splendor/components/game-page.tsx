import { SplendorProvider } from "@/splendor/components/context";
import { GameView } from "@/splendor/components/game-view";
import { getGame } from "@/splendor/core/actions";

export async function SplendorGamePage( { params }: { params: { gameId: string } } ) {
	const data = await getGame( { gameId: params.gameId } );
	return (
		<SplendorProvider data={ data }>
			<GameView/>
		</SplendorProvider>
	);
} 