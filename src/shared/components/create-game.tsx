"use client";

import { Button } from "@/shared/primitives/button";
import { type ReactNode, useTransition } from "react";
import { navigate } from "rwsdk/client";

type CreateGameProps = {
	game: string;
	disabled?: boolean;
	createGame: () => Promise<string>;
	children?: ReactNode;
};

export function CreateGame( { game, disabled, createGame, children }: CreateGameProps ) {
	const [ isPending, startTransition ] = useTransition();

	const handleCreate = () => startTransition( async () => {
		const gameId = await createGame();
		await navigate( `/${ game }/${ gameId }` );
	} );

	return (
		<div className={ "rounded-md bg-background p-6 flex flex-col gap-4 flex-1 max-w-2xl" }>
			<h2 className={ "text-xl font-heading" }>New Game</h2>
			<p className={ "text-sm text-muted-foreground" }>
				Create a game and share the code with a friend
			</p>
			{ children }
			<Button onClick={ handleCreate } disabled={ disabled || isPending }>
				Create Game
			</Button>
		</div>
	);
}
