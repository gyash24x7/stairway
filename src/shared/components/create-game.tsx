"use client";

import { Button } from "@/shared/primitives/button";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

type CreateGameProps = {
	game: string;
	disabled?: boolean;
	createGame: () => Promise<string>;
	children?: ReactNode;
};

export function CreateGame( { game, disabled, createGame, children }: CreateGameProps ) {
	const navigate = useNavigate();
	const { isPending, mutate } = useMutation( {
		mutationFn: createGame,
		onSuccess: matchId => navigate( { to: `/${ game }/${ matchId }` } )
	} );

	const handleCreate = () => mutate();

	return (
		<div className={ "rounded-md bg-background p-6 flex flex-col gap-4 flex-1" }>
			<h2 className={ "text-xl font-heading" }>New Game</h2>
			<p className={ "text-sm text-muted-foreground" }>
				Create a match and share the code with a friend
			</p>
			{ children }
			<Button onClick={ handleCreate } disabled={ disabled || isPending }>Create Match</Button>
		</div>
	);
}
