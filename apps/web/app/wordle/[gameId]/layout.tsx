import { GameStoreProvider, getGameAction } from "@literature/ui";
import { ReactNode } from "react";

export type WordleGameLayoutProps = {
	params: { gameId: string };
	children: ReactNode;
}

export default async function WordleGameLayout( { params, children }: WordleGameLayoutProps ) {
	const [ gameData, err ] = await getGameAction( { gameId: params.gameId } );

	if ( err ) {
		return <div>Error fetching game data!</div>;
	}

	return (
		<GameStoreProvider gameData={ gameData }>
			{ children }
		</GameStoreProvider>
	);
}