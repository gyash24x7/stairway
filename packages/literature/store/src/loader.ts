import type { LoaderFunctionArgs } from "react-router-dom";
import { literatureClient } from "./client";
import { useGameStore } from "./store";

export async function gameStoreLoader( { params }: LoaderFunctionArgs ) {
	const gameId = params[ "gameId" ] ?? "";
	const initialState = useGameStore.getState();
	const { gameData, playerData } = await literatureClient.loadGameData( { gameId } );
	initialState.gameData = gameData;
	initialState.playerData = playerData;
	useGameStore.setState( initialState );
	return initialState;
}