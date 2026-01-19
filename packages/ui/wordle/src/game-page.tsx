import type { PlayerGameInfo } from "@s2h/wordle/types";
import { useEffect } from "react";
import { GameView } from "./game-view.tsx";
import { updateGameData } from "./store.tsx";

export function WordleGamePage( props: { data: PlayerGameInfo } ) {
	useEffect( () => {
		updateGameData( props.data );
	}, [ props.data ] );

	return <GameView/>;
}