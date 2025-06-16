import { GamePage } from "@/wordle/components/game-page";
import { getGameData } from "@/wordle/server/functions";

export async function WordleGame( { params }: { params: Promise<{ gameId: string }> } ) {
	const { gameId } = await params;
	const [ err, data ] = await getGameData( { gameId } );

	if ( !!err || !data ) {
		throw "Game not found!";
	}

	return <GamePage data={ data }/>;
}