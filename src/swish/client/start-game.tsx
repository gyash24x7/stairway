"use client";

import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";

export type StartGameProps = {
	startGame: () => void;
	disabled?: boolean;
};

/**
 * The manual-start control for a game sitting at `PLAYERS_READY` — every seat is
 * filled but the game waits for someone to begin. Only shown for a game whose
 * config sets `autoStart: false`; an auto-starting game never reaches that status.
 * The server gates the command on membership, so only a seated player can start.
 *
 * Presentational on purpose: every game's context already owns the mutation and
 * its invalidation, and four of them were hand-rolling this button rather than
 * reaching for a component that wanted a query key they had no reason to hold.
 */
export function StartGame( { startGame, disabled }: StartGameProps ) {
	return (
		<Button onClick={ startGame } disabled={ disabled }>
			{ disabled ? <Spinner/> : "START GAME" }
		</Button>
	);
}
