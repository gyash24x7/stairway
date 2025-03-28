import { GamePage } from "@/components/wordle/game-page";
import { getAuthInfo } from "@/server/utils/auth";
import { getGameData } from "@/server/wordle/functions";
import { redirect } from "next/navigation";

export default async function WordleGamePage( { params }: { params: Promise<{ gameId: string }> } ) {
	const authInfo = await getAuthInfo();

	if ( !authInfo ) {
		redirect( "/wordle" );
	}

	const { gameId } = await params;
	const data = await getGameData( { gameId } );

	if ( !data ) {
		throw "Game not found!";
	}

	return <GamePage data={ data }/>;
}