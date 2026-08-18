import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import type { ReactNode } from "react";

import { Button } from "@/shared/ui/primitives/button.tsx";

import type { GameRef } from "@/swish/shared/schema.ts";

type CreateGameProps = {
	game: string;
	disabled?: boolean;
	createGame: () => Promise<GameRef>;
	children?: ReactNode;
};

export function CreateGame( {
	game,
	disabled,
	createGame: createGameFn,
	children
}: CreateGameProps ) {
	const navigate = useNavigate();

	const createGame = useMutation( {
		mutationFn: createGameFn,
		onSuccess: ( { id } ) => navigate( { to: `/${ game }/$gameId`, params: { gameId: id } } )
	} );

	return (
		<div className={ "rounded-md bg-background p-6 flex flex-col gap-4 flex-1 max-w-2xl" }>
			<h2 className={ "text-xl font-heading" }>New Game</h2>
			<p className={ "text-sm text-muted-foreground" }>
				Create a game and share the code with a friend
			</p>
			{ children }
			<Button
				onClick={ () => createGame.mutate() }
				disabled={ disabled || createGame.isPending }
			>
				Create Game
			</Button>
		</div>
	);
}
