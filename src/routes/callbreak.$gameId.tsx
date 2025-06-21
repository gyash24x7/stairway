import { GamePage } from "@/callbreak/components/game-page";
import { getGameData } from "@/callbreak/server/functions";
import { type RequestInfo } from "rwsdk/worker";

export async function CallbreakGame( { params, ctx }: RequestInfo<{ gameId: string }> ) {
	const { error, data } = await getGameData( params.gameId );
	console.log( "data", data );

	if ( !!error || !data ) {
		throw "Game not found!";
	}

	return <GamePage data={ { ...data, playerId: ctx.authInfo!.id, hand: [], scores: [] } }/>;
}