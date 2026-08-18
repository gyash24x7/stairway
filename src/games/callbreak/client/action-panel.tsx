"use client";

import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import { DeclareWins } from "@/games/callbreak/client/declare-wins.tsx";
import { PlayCard } from "@/games/callbreak/client/play-card.tsx";
import { ActionBar } from "@/swish/client/action-bar.tsx";
import { AddBots, AutoPlayToggle } from "@/swish/client/seat-controls.tsx";
import { StartGame } from "@/swish/client/start-game.tsx";

/**
 * The sticky action bar on the full page. Every control it shows needs a seat, so
 * a screen with none (a spectator, or the account driving a television) gets
 * nothing.
 */
export function ActionPanel() {
	const { data, playerId, isMyTurn, actions, isPending } = useCallbreak();

	if ( !playerId ) {
		return null;
	}

	const phase = data.context.phase;
	const isPlaying = data.status === "IN_PROGRESS";
	const autoPlaying = data.autoPlay[ playerId ] ?? false;

	return (
		<ActionBar>
			{ data.status === "CREATED" && (
				<AddBots addBots={ actions.addBots } disabled={ isPending }/>
			) }
			{ data.status === "PLAYERS_READY" && (
				<StartGame startGame={ actions.startGame } disabled={ isPending }/>
			) }
			{ isPlaying && (
				<AutoPlayToggle
					autoPlaying={ autoPlaying }
					setAutoPlay={ actions.setAutoPlay }
					disabled={ isPending }
				/>
			) }
			{ isPlaying && !autoPlaying && phase === "DECLARING" && isMyTurn && <DeclareWins/> }
			{ isPlaying && !autoPlaying && phase === "PLAYING" && isMyTurn && <PlayCard/> }
		</ActionBar>
	);
}
