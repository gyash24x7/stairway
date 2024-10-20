import { getAuthInfo } from "@stairway/api/auth";
import { getGameData } from "@stairway/api/callbreak";
import { Spinner } from "@stairway/components/base";
import { GamePage } from "@stairway/components/callbreak";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function CallbreakGamePage( { params: { gameId } }: { params: { gameId: string } } ) {
	const authInfo = await getAuthInfo();
	if ( !authInfo ) {
		return redirect( "/" );
	}

	const gameData = await getGameData( gameId );

	return (
		<Suspense fallback={ <Spinner/> }>
			<GamePage gameData={ gameData }/>
		</Suspense>
	);
}