import { getAuthInfo } from "@/utils/actions.ts";
import { getGameData } from "@stairway/api/literature";
import { Spinner } from "@stairway/components/base";
import { GamePage } from "@stairway/components/literature";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function LiteratureGamePage( { params: { gameId } }: { params: { gameId: string } } ) {
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