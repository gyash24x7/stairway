"use client";

import { createGame } from "@stairway/api/wordle";
import { Button, Spinner } from "@stairway/components/base";
import { redirect } from "next/navigation";
import { useTransition } from "react";

export function CreateGame() {
	const [ isPending, startTransition ] = useTransition();

	const createGameFn = () => startTransition( async () => {
		const game = await createGame( { wordCount: 4 } );
		redirect( `/wordle/${ game.id }` );
	} );

	return (
		<Button onClick={ createGameFn } disabled={ isPending }>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}
