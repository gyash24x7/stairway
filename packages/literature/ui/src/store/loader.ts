import { useAuthStore } from "@common/ui";
import { vanillaClient } from "./client";
import { useGameStore } from "./store";

export async function gameStoreLoader( gameId: string ) {
	const { gameData, cardsData, cardLocationsData } = await vanillaClient.getGameData.query( { gameId } );
	if ( !gameData ) {
		throw new Error( "Unable to load Game Data!" );
	}

	const authStore = useAuthStore.getState();

	const gameStore = useGameStore.getState();
	gameStore.gameData = gameData;
	gameStore.hand = cardsData.hands[ authStore.authUser!.id ];
	gameStore.cardLocations = cardLocationsData[ authStore.authUser!.id ];

	return { gameData };
}