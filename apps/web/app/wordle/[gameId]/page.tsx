import { getAuthInfo } from "@/utils/actions.ts";
import { getGameData } from "@stairway/api/wordle";
import { Spinner } from "@stairway/components/base";
import { GamePage } from "@stairway/components/wordle";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function WordleGamePage( { params: { gameId } }: { params: { gameId: string } } ) {
	const authInfo = await getAuthInfo();
	if ( !authInfo ) {
		return redirect( "/" );
	}

	const game = await getGameData( gameId );

	return (
		<Suspense fallback={ <Spinner/> }>
			<GamePage game={ game }/>
		</Suspense>
	);
}