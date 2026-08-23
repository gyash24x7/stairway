"use client";

import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import { DeclarationsRow } from "@/games/callbreak/client/declarations-row.tsx";
import { DeclareWins } from "@/games/callbreak/client/declare-wins.tsx";
import { HandView } from "@/games/callbreak/client/hand-view.tsx";
import { PlayCard } from "@/games/callbreak/client/play-card.tsx";
import { SuitBar } from "@/games/callbreak/client/suit-bar.tsx";
import { TrickStrip } from "@/games/callbreak/client/trick-strip.tsx";
import { ControllerShell } from "@/swish/client/controller-shell.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { PlayerLobbyGrid } from "@/swish/client/player-lobby.tsx";
import { Rematch } from "@/swish/client/rematch.tsx";
import { AddBots, AutoPlayToggle } from "@/swish/client/seat-controls.tsx";
import { StartGame } from "@/swish/client/start-game.tsx";

/**
 * The phone half. Your hand plus the compact trick context; the four seats, the
 * turn order and the winner animations are on the television.
 *
 * `HandView`, `DeclareWins` and `PlayCard` are reused verbatim — `HandView`
 * already gates selection on both `isMyTurn` and the playable-card rules.
 */
export function ControllerView() {
	const { data, playerId, isMyTurn, actions, isPending } = useCallbreak();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";
	const phase = data.context.phase;

	const waitingFor = data.players[ data.context.currentPlayer ]?.name;
	const autoPlaying = !!playerId && ( data.autoPlay[ playerId ] ?? false );
	const humans = data.context.players.filter( pid => !data.players[ pid ].isBot ).length;

	return (
		<ControllerShell
			game={ "callbreak" }
			code={ data.code }
			isMyTurn={ isMyTurn || isLobby }
			waitingFor={ waitingFor }
			deadline={ data.deadline }
			completed={ data.status === "COMPLETED" }
			channelId={ data.id }
			persistentActions={ isPlaying && (
				<AutoPlayToggle
					autoPlaying={ autoPlaying }
					setAutoPlay={ actions.setAutoPlay }
					disabled={ isPending }
				/>
			) }
			actions={
				<>
					{ data.status === "CREATED" && (
						<AddBots addBots={ actions.addBots } disabled={ isPending }/>
					) }
					{ data.status === "PLAYERS_READY" && (
						<StartGame startGame={ actions.startGame } disabled={ isPending }/>
					) }
					{ isPlaying && !autoPlaying && phase === "DECLARING" && isMyTurn && <DeclareWins/> }
					{ isPlaying && !autoPlaying && phase === "PLAYING" && isMyTurn && <PlayCard/> }
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

			{ isPlaying && (
				<div className={ "flex flex-col gap-3 w-full" }>
					<SuitBar/>
					{ phase === "DECLARING" ? <DeclarationsRow/> : <TrickStrip/> }
					<HandView/>
				</div>
			) }

			{ data.status === "COMPLETED" && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<GameStandings
						results={ data.results }
						players={ data.players }
						playerId={ playerId }
						scoreLabel={ "SCORE" }
					/>

					<Rematch
						game={ "callbreak" }
						screen={ "controller" }
						completed
						rematch={ data.rematch }
						startRematch={ playerId ? actions.startRematch : undefined }
						humans={ humans }
						disabled={ isPending }
					/>
				</div>
			) }
		</ControllerShell>
	);
}
