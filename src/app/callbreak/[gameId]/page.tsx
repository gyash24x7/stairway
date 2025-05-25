import { getAuthInfo } from "@/auth/server/functions";
import { GamePage } from "@/callbreak/components/game-page";
import { getGameData } from "@/callbreak/server/functions";
import { redirect } from "next/navigation";

export default async function CallbreakGamePage( { params }: { params: Promise<{ gameId: string }> } ) {
	const authInfo = await getAuthInfo();

	if ( !authInfo ) {
		redirect( "/wordle" );
	}

	const { gameId } = await params;
	const [ err, data ] = await getGameData( { gameId } );

	if ( !!err || !data ) {
		throw "Game not found!";
	}

	return <GamePage data={ data }/>;
}