"use client";

import { RCardSuit } from "@/shared/ui/components/card.tsx";
import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { CouchLobby } from "@/shared/ui/couch/couch-lobby.tsx";
import { CouchShell } from "@/shared/ui/couch/couch-shell.tsx";
import { PLAYER_COUNT } from "@/games/callbreak/shared/utils.ts";
import { useCallbreakTable } from "@/games/callbreak/client/context.tsx";
import { DealView } from "@/games/callbreak/client/deal-view.tsx";
import { Scores } from "@/games/callbreak/client/scores.tsx";

/**
 * The shared screen. `DealView` and `Scores` read the public view only, so both
 * are reused verbatim from the phone — there is no hand on this projection to leak.
 */
export function CouchView() {
	const { data } = useCallbreakTable();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";
	const isCompleted = data.status === "COMPLETED";

	const currentName = ( data.players[ data.context.currentPlayer ]?.name ?? "" ).toUpperCase();

	const turn = isLobby
		? ( data.status === "CREATED"
			? "WAITING FOR PLAYERS — ADD BOTS FROM A PHONE"
			: "START FROM ANY PHONE" )
		: isPlaying
			? ( data.context.phase === "DECLARING"
				? `${ currentName } IS DECLARING`
				: `${ currentName }'S TURN` )
			: "GAME OVER";

	return (
		<CouchShell
			game={ "callbreak" }
			code={ data.code }
			turn={ turn }
			// In play the seats fill the stage; once it's over the standings do.
			stretch={ !isLobby }
			headerInfo={
				<div className={ "flex gap-12 justify-center" }>
					<div className={ "text-center" }>
						<p className={ "text-2xl tracking-widest text-foreground/70" }>TRUMP</p>
						<RCardSuit suit={ data.config.trumpSuit } large themed className={ "md:text-6xl" }/>
					</div>
					<div className={ "text-center" }>
						<p className={ "text-2xl tracking-widest text-foreground/70" }>DEALS</p>
						<p className={ "text-6xl font-heading leading-none" }>
							{ data.config.dealCount }
						</p>
					</div>
				</div>
			}
			// The running scoreboard belongs to a game in progress. Once it's over the
			// standings take the stage and the rail keeps the faces around the table.
			seats={ isPlaying ? <Scores large/> : isCompleted ? <DealView fill/> : null }
		>
			{ isLobby && (
				<CouchLobby
					game={ "callbreak" }
					code={ data.code }
					players={ data.context.players.map( id => data.players[ id ] ) }
					seats={ PLAYER_COUNT }
				/>
			) }
			{ isPlaying && !!data.view.activeDeal && <DealView fill/> }
			{ isCompleted && (
				<GameStandings
					results={ data.results }
					players={ data.players }
					scoreLabel={ "SCORE" }
					large
					className={ "h-full" }
				/>
			) }
		</CouchShell>
	);
}
