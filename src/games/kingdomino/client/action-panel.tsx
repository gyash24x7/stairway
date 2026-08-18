"use client";

import { useKingdomino } from "@/games/kingdomino/client/context.tsx";
import { PlayerBoards } from "@/games/kingdomino/client/player-boards.tsx";
import { ActionBar } from "@/swish/client/action-bar.tsx";
import { AutoPlayToggle } from "@/swish/client/seat-controls.tsx";

/**
 * The sticky action bar on the full page. Every control it shows needs a seat, so
 * a screen with none (a spectator, or the account driving a television) gets
 * nothing.
 */
export function ActionPanel() {
	const { data, playerId, setAutoPlay, isPending } = useKingdomino();

	const isPlaying = data.status === "IN_PROGRESS";

	// Nothing to offer without a seat, and nothing once the game is over — and an
	// empty bar now reserves real space, since it measures itself.
	if ( !playerId || !isPlaying ) {
		return null;
	}

	const autoPlaying = data.autoPlay[ playerId ] ?? false;

	return (
		<ActionBar>
			<PlayerBoards/>
			<AutoPlayToggle
				autoPlaying={ autoPlaying }
				setAutoPlay={ setAutoPlay }
				disabled={ isPending }
			/>
		</ActionBar>
	);
}
