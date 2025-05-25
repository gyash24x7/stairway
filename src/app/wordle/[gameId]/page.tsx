import { getAuthInfo } from "@/auth/server/functions";
import { GamePage } from "@/wordle/components/game-page";
import { getGameData } from "@/wordle/server/functions";
import { redirect } from "next/navigation";

export default async function WordleGamePage( { params }: { params: Promise<{ gameId: string }> } ) {
	const authInfo = await getAuthInfo();

	if ( !authInfo ) {
		redirect( "/wordle" );
	}

	const { gameId } = await params;
	const [ err, data ] = await getGameData( { gameId } );

	if ( !data || !!err ) {
		throw "Game not found!";
	}

	return <GamePage data={ data }/>;
}