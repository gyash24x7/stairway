import { GamePage } from "@/components/callbreak/game-page";
import { Subscriber } from "@/components/callbreak/subscriber";
import { getGameData } from "@/server/callbreak/functions";
import { getAuthInfo } from "@/server/utils/auth";
import { redirect } from "next/navigation";

export default async function CallbreakGamePage( { params }: { params: Promise<{ gameId: string }> } ) {
	const authInfo = await getAuthInfo();

	if ( !authInfo ) {
		redirect( "/wordle" );
	}

	const { gameId } = await params;
	const data = await getGameData( { gameId } );

	if ( !data ) {
		throw "Game not found!";
	}

	return (
		<Subscriber gameId={ gameId } playerId={ authInfo.id }>
			<GamePage data={ data }/>
		</Subscriber>
	);
}