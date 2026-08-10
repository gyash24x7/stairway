"use client";

import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { PlayerLobbyGrid } from "@/shared/ui/components/player-lobby.tsx";
import { StartGame } from "@/shared/ui/components/start-game.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { ControllerShell } from "@/shared/ui/couch/controller-shell.tsx";
import { startGameFn } from "@/games/callbreak/client/client.ts";
import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import { DeclarationsRow } from "@/games/callbreak/client/declarations-row.tsx";
import { DeclareWins } from "@/games/callbreak/client/declare-wins.tsx";
import { HandView } from "@/games/callbreak/client/hand-view.tsx";
import { PlayCard } from "@/games/callbreak/client/play-card.tsx";
import { SuitBar } from "@/games/callbreak/client/suit-bar.tsx";
import { TrickStrip } from "@/games/callbreak/client/trick-strip.tsx";

/**
 * The phone half. Your hand plus the compact trick context; the four seats, the
 * turn order and the winner animations are on the television.
 *
 * `HandView`, `DeclareWins` and `PlayCard` are reused verbatim — `HandView`
 * already gates selection on both `isMyTurn` and the playable-card rules.
 */
export function ControllerView() {
	const { data, isMyTurn, addBots } = useCallbreak();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";
	const phase = data.context.phase;

	const waitingFor = data.players[ data.context.currentPlayer ]?.name;

	return (
		<ControllerShell
			game={ "callbreak" }
			code={ data.code }
			isMyTurn={ isMyTurn || isLobby }
			waitingFor={ waitingFor }
			channelId={ data.id }
			actions={
				<>
					{ data.status === "CREATED" && (
						<Button onClick={ () => addBots.mutate() } disabled={ addBots.isPending }>
							{ addBots.isPending ? <Spinner/> : "ADD BOTS" }
						</Button>
					) }
					{ data.status === "PLAYERS_READY" && (
						<StartGame
							gameId={ data.id }
							queryKey={ [ "callbreak", "getState", data.id ] }
							startGame={ startGameFn }
						/>
					) }
					{ isPlaying && phase === "DECLARING" && isMyTurn && <DeclareWins/> }
					{ isPlaying && phase === "PLAYING" && isMyTurn && <PlayCard/> }
				</>
			}
		>
			{ isLobby && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<p className={ "text-lg font-heading text-center" }>
						YOU'RE SEATED
					</p>
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
					<p className={ "text-lg font-heading" }>GAME OVER</p>
					<GameStandings
						results={ data.results }
						players={ data.players }
						playerId={ data.view.playerId }
						scoreLabel={ "SCORE" }
					/>
				</div>
			) }
		</ControllerShell>
	);
}
