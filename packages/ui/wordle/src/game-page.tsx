import { cn } from "@s2h-ui/primitives/utils";
import type { PlayerGameInfo } from "@s2h/wordle/types";
import { useEffect } from "react";
import { DisplayGame } from "./display-game.tsx";
import { updateGameData } from "./store.tsx";

export function WordleGamePage( props: { data: PlayerGameInfo } ) {
	useEffect( () => {
		updateGameData( props.data );
	}, [ props.data ] );

	return (
		<div className={ `flex flex-col items-center mb-20` }>
			<h1 className={ cn( "text-4xl my-3 font-heading" ) }>WORDLE</h1>
			<DisplayGame/>
		</div>
	);
}