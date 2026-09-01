"use client";

import { ActionPanel } from "@/games/coup/client/action-panel.tsx";
import { ActivityLog } from "@/games/coup/client/activity-log.tsx";
import { useCoup } from "@/games/coup/client/context.tsx";
import { ReactionPrompt } from "@/games/coup/client/reaction-prompt.tsx";
import { SeatsView } from "@/games/coup/client/seats-view.tsx";
import { ControllerShell } from "@/swish/client/controller-shell.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { PlayerLobbyGrid } from "@/swish/client/player-lobby.tsx";
import { Rematch } from "@/swish/client/rematch.tsx";
import { AddBots, AutoPlayToggle } from "@/swish/client/seat-controls.tsx";
import { StartGame } from "@/swish/client/start-game.tsx";

/**
 * The phone half.
 *
 * This is the screen Coup actually needs one for: your two cards are the whole
 * of your private information, and they have to be somewhere the room cannot
 * see. So the phone holds the hand and every control, and the television holds
 * the table, the coins and the commentary.
 *
 * The turn control and the reaction prompt are the same components the single
 * screen uses. A reaction window is not a turn — for most of a turn the phone
 * being asked to answer belongs to somebody who is not the current player — so
 * the prompt sits outside `actions` and opens itself.
 */
export function ControllerView() {
	const {
		data,
		playerId,
		isMyTurn,
		awaiting,
		frame,
		addBots,
		startGame,
		setAutoPlay,
		startRematch,
		isPending
	} = useCoup();

	const humans = data.context.players.filter( id => !data.players[ id ].isBot ).length;

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const autoPlaying = !!playerId && ( data.autoPlay[ playerId ] ?? false );

	// While a window is open the table is not waiting on the current player, so
	// naming them would be wrong. Name whoever it is actually waiting on.
	const stillToAnswer = frame
		? frame.responders.filter( id => !( id in frame.responses ) )
		: [];

	const waitingFor = stillToAnswer.length > 0
		? data.players[ stillToAnswer[ 0 ]! ]?.name
		: data.players[ data.context.currentPlayer ]?.name;

	return (
		<ControllerShell
			game={ "coup" }
			code={ data.code }
			// A seat with a window to answer is as much "on" as one taking a turn.
			isMyTurn={ isMyTurn || awaiting !== undefined || isLobby }
			waitingFor={ waitingFor }
			deadline={ frame?.deadline ?? data.deadline }
			completed={ data.status === "COMPLETED" }
			channelId={ data.id }
			persistentActions={ data.status === "IN_PROGRESS" && (
				<AutoPlayToggle
					autoPlaying={ autoPlaying }
					setAutoPlay={ setAutoPlay }
					disabled={ isPending }
				/>
			) }
			actions={
				<>
					{ data.status === "CREATED" && (
						<AddBots addBots={ addBots } disabled={ isPending }/>
					) }
					{ data.status === "PLAYERS_READY" && (
						<StartGame startGame={ startGame } disabled={ isPending }/>
					) }
					{ isMyTurn && !autoPlaying && <ActionPanel/> }
				</>
			}
		>
			{ isLobby && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<p className={ "text-lg font-heading text-center" }>YOU&apos;RE SEATED</p>
					<PlayerLobbyGrid
						players={ data.context.players.map( id => data.players[ id ] ) }
					/>
				</div>
			) }

			{ /* The same grid the other two screens show. This seat's cards are face
			     up in it and everybody else's are counts, so a player reads their own
			     hand where they read the table. */ }
			{ data.status === "IN_PROGRESS" && (
				<div className={ "flex flex-col gap-3 w-full" }>
					<SeatsView/>
					<ActivityLog/>
				</div>
			) }

			{ data.status === "COMPLETED" && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<GameStandings
						results={ data.results }
						players={ data.players }
						playerId={ playerId }
					/>

					<Rematch
						game={ "coup" }
						screen={ "controller" }
						completed
						rematch={ data.rematch }
						startRematch={ playerId ? startRematch : undefined }
						humans={ humans }
						disabled={ isPending }
					/>
				</div>
			) }

			<ReactionPrompt/>
		</ControllerShell>
	);
}
