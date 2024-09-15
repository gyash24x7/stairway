"use client";

import { GameCompleted, GameInProgress, useIsGameCompleted } from "@wordle/ui";

export default function WordleGamePage() {
	const isGameCompleted = useIsGameCompleted();

	return (
		<div className={ `flex flex-col mt-10 gap-12` }>
			{ isGameCompleted ? <GameCompleted/> : <GameInProgress/> }
		</div>
	);
}