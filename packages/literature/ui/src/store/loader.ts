import { vanillaClient } from "./client";
import { useGameStore } from "./store";

export async function gameStoreLoader( gameId: string ) {
	const { gameData, playerSpecificData } = await vanillaClient.getGameData.query( { gameId } );
	if ( !gameData || !playerSpecificData ) {
		throw new Error( "Unable to load Game Data!" );
	}

	const gameStore = useGameStore.getState();
	gameStore.gameData = gameData;
	gameStore.playerSpecificData = playerSpecificData;

	return { gameData, playerSpecificData };
}