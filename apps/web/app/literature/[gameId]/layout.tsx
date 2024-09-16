import { GameStoreProvider, getGameAction } from "@literature/ui";
import { ReactNode } from "react";

export type LiteratureGameLayoutProps = {
	params: { gameId: string };
	children: ReactNode;
}

export default async function LiteratureGameLayout( { params, children }: LiteratureGameLayoutProps ) {
	const [ gameData, err ] = await getGameAction( { gameId: params.gameId } );

	if ( err ) {
		return <div>Error fetching game data!</div>;
	}

	return (
		<GameStoreProvider gameData={ JSON.parse( JSON.stringify( gameData ) ) }>
			{ children }
		</GameStoreProvider>
	);
}