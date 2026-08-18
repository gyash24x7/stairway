"use client";

import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import { DealView } from "@/games/callbreak/client/deal-view.tsx";
import { Scores } from "@/games/callbreak/client/scores.tsx";
import { CALLBREAK_TRICKS_PER_DEAL } from "@/games/callbreak/shared/schema.ts";
import { RCardSuit } from "@/shared/ui/components/card.tsx";
import { CouchLobby } from "@/swish/client/couch-lobby.tsx";
import { CouchShell } from "@/swish/client/couch-shell.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { StatBlock } from "@/swish/client/stat-block.tsx";
import { turnText } from "@/swish/client/turn-banner.tsx";

/**
 * The shared screen. `DealView` and `Scores` read the public part of the view
 * only, so both are reused verbatim from the phone — there is no hand on this
 * screen to leak.
 */
export function CouchView() {
	const { data } = useCallbreak();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";
	const isCompleted = data.status === "COMPLETED";

	const activeDeal = data.view.activeDeal;
	const completedTricks = activeDeal?.tricks.filter( t => !!t.winner ) ?? [];
	const turn = turnText( {
		status: data.status,
		players: data.players,
		currentPlayer: data.context.currentPlayer,
		action: data.context.phase === "DECLARING" ? "DECLARING" : undefined,
		seated: data.context.players.length,
		playerCount: data.config.playerCount,
		couch: true
	} );

	return (
		<CouchShell
			game={ "callbreak" }
			code={ data.code }
			turn={ turn }
			deadline={ data.deadline }
			currentPlayer={ data.status === "IN_PROGRESS" ? data.context.currentPlayer : undefined }
			players={ data.players }
			stretch={ !isLobby }
			headerInfo={
				<div className={ "flex gap-12" }>
					<StatBlock label={ "TRUMP" } large>
						<RCardSuit suit={ data.config.trumpSuit } large themed className={ "md:text-6xl" }/>
					</StatBlock>
					<StatBlock label={ "COMPLETED DEALS" } large>
						{ data.view.dealsPlayed }/{ data.config.dealCount }
					</StatBlock>
					<StatBlock label={ "COMPLETED TRICKS" } large>
						{ completedTricks.length }/{ CALLBREAK_TRICKS_PER_DEAL }
					</StatBlock>
				</div>
			}
			// The running scoreboard belongs to a game in progress. Once it's over the
			// standings take the stage and the rail keeps the faces around the table.
			seats={ isPlaying ? <Scores large/> : isCompleted ? <DealView fill/> : null }
		>
			{ isLobby && (
				<CouchLobby
					players={ data.context.players.map( id => data.players[ id ] ) }
					seats={ data.config.playerCount }
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
