"use client";

import { observer } from "@legendapp/state/react";
import type { Game } from "@stairway/api/wordle";
import { cn, fjalla, Spinner } from "@stairway/components/base";
import { useIsGameCompleted, wordle$ } from "@stairway/stores/wordle";
import { useEffect, useState } from "react";
import { CreateGame } from "./create-game.tsx";
import { GuessBlocks, GuessDiagramBlocks } from "./guess-blocks.tsx";
import { Keyboard } from "./keyboard.tsx";

export const GamePage = observer( ( props: { game: Game | null } ) => {
	const [ isLoading, setIsLoading ] = useState( true );
	const isGameCompleted = useIsGameCompleted();

	useEffect( () => {
		if ( props.game ) {
			wordle$.game.set( props.game );
			setIsLoading( false );
		}
	}, [] );

	return (
		<div className={ `flex flex-col items-center mb-20` }>
			<h1 className={ cn( "text-4xl my-3", fjalla.className ) }>WORDLE</h1>
			{ isLoading && <Spinner/> }
			{ !isLoading && isGameCompleted && (
				<div className={ "flex flex-col gap-12 items-center" }>
					<h1 className={ "text-4xl font-fjalla text-green-600" }>Game Completed</h1>
					<GuessDiagramBlocks/>
					<div
						className={ cn(
							"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
							"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
						) }
					>
						<h2>TRY AGAIN?</h2>
						<CreateGame/>
					</div>
				</div>
			) }
			{ !isLoading && !isGameCompleted && (
				<div>
					<GuessBlocks/>
					<div
						className={ cn(
							"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
							"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
						) }
					>
						<Keyboard/>
					</div>
				</div>
			) }
		</div>
	);
} );