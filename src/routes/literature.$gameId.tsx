import { GamePage } from "@/literature/components/game-page";
import { getGameData } from "@/literature/server/functions";
import { type RequestInfo } from "rwsdk/worker";

export async function LiteratureGame( { params }: RequestInfo<{ gameId: string }> ) {
	const { error, data } = await getGameData( params );

	if ( !!error || !data ) {
		throw "Game not found!";
	}

	return <GamePage data={ { ...data } }/>;
}