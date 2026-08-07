"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";

import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";

export type StartGameProps = {
	gameId: string;
	queryKey: QueryKey;
	startGame: ( gameId: string ) => Promise<void>;
};

/**
 * The manual-start control for a game sitting at `PLAYERS_READY` — every seat is
 * filled but the game waits for someone to begin. Only shown for a game whose
 * config sets `autoStart: false`; an auto-starting game never reaches that status.
 * The server gates the command on membership, so only a seated player can start.
 */
export function StartGame( { gameId, queryKey, startGame }: StartGameProps ) {
	const queryClient = useQueryClient();

	const start = useMutation( {
		mutationFn: () => startGame( gameId ),
		onSuccess: () => queryClient.invalidateQueries( { queryKey } )
	} );

	return (
		<Button onClick={ () => start.mutate() } disabled={ start.isPending }>
			{ start.isPending ? <Spinner/> : "START GAME" }
		</Button>
	);
}
