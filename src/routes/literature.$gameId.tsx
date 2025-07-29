import { GamePage } from "@/fish/components/game-page";
import { getGameStore } from "@/fish/server/functions";
import { type RequestInfo } from "rwsdk/worker";

export async function LiteratureGame( { params }: RequestInfo<{ gameId: string }> ) {
	const { error, data } = await getGameStore( params );

	if ( !!error || !data ) {
		throw "Game not found!";
	}

	return <GamePage data={ { ...data } }/>;
}