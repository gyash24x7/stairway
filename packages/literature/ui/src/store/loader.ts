import type { LoaderFunctionArgs } from "react-router-dom";
import { literatureClient } from "./client";
import { useGameStore } from "./store";

export async function gameStoreLoader( { params }: LoaderFunctionArgs ) {
	const gameId = params[ "gameId" ] ?? "";
	const initialState = useGameStore.getState();
	initialState.gameData = await literatureClient.loadGameData( { gameId } );
	initialState.playerData = await literatureClient.loadPlayerData( { gameId } );
	useGameStore.setState( initialState );
	return initialState;
}