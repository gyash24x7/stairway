import { vanillaClient } from "./client";
import { useGameStore } from "./store";

export async function gameStoreLoader( gameId: string ) {
	const gameData = await vanillaClient.getGame.query( { gameId } );
	if ( !gameData ) {
		throw new Error( "Unable to load Game Data!" );
	}

	const gameStore = useGameStore.getState();
	gameStore.gameData = gameData;

	return { gameData };
}