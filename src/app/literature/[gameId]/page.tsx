import { getAuthInfo } from "@/auth/server/functions";
import { GamePage } from "@/literature/components/game-page";
import { getGameData } from "@/literature/server/functions";
import { redirect } from "next/navigation";

export default async function LiteratureGamePage( { params }: { params: Promise<{ gameId: string }> } ) {
	const authInfo = await getAuthInfo();

	if ( !authInfo ) {
		redirect( "/literature" );
	}

	const { gameId } = await params;
	const [ err, data ] = await getGameData( { gameId } );

	if ( !data || !!err ) {
		throw "Game not found!";
	}

	return <GamePage data={ data }/>;
}