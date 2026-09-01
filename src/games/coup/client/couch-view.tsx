"use client";

import { ActivityLog } from "@/games/coup/client/activity-log.tsx";
import { useCoup } from "@/games/coup/client/context.tsx";
import { SeatsView } from "@/games/coup/client/seats-view.tsx";
import { CouchLobby } from "@/swish/client/couch-lobby.tsx";
import { CouchShell } from "@/swish/client/couch-shell.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { RematchNotice, useFollowRematch } from "@/swish/client/rematch.tsx";
import { StatBlock } from "@/swish/client/stat-block.tsx";
import { turnText } from "@/swish/client/turn-banner.tsx";

/**
 * The shared screen.
 *
 * It renders the same seat components the phone does, scaled up by `CouchShell`'s
 * design canvas, and it can show every seat rather than only the opponents —
 * there is no viewing player here to keep a secret from, and no seat's cards in
 * the snapshot to leak.
 *
 * What the room actually needs off a television is the running commentary: who
 * claimed what, who called it, and who is being waited on. That is the whole of
 * the layout.
 */
export function CouchView() {
	const { data, frame } = useCoup();

	// The room moved on and this screen has no way to be told to follow, so it
	// follows — after long enough for the standings it is showing to be read.
	useFollowRematch( "coup", data.rematch );

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";

	const waitingOn = frame
		? frame.responders.filter( id => !( id in frame.responses ) )
			.map( id => data.players[ id ]?.name ?? "someone" )
		: [];

	const turn = turnText( {
		status: data.status,
		players: data.players,
		currentPlayer: data.context.currentPlayer,
		note: waitingOn.length > 0 ? `WAITING ON ${ waitingOn.join( ", " ) }` : undefined,
		seated: data.context.players.length,
		playerCount: data.config.playerCount,
		couch: true
	} );

	return (
		<CouchShell
			game={ "coup" }
			code={ data.code }
			notice={ <RematchNotice rematch={ data.rematch }/> }
			turn={ turn }
			// A reaction window runs its own clock, and while one is open that is
			// the countdown the room cares about.
			deadline={ frame?.deadline ?? data.deadline }
			currentPlayer={ isPlaying ? data.context.currentPlayer : undefined }
			players={ data.players }
			stretch={ !isLobby }
			headerInfo={ <StatBlock label={ "DECK" } large>{ data.view.deckCount }</StatBlock> }
			seats={
				isLobby ? null : (
					<div className={ "h-full min-h-0 w-full flex flex-col justify-end" }>
						<ActivityLog large/>
					</div>
				)
			}
		>
			{ isLobby && (
				<CouchLobby
					players={ data.context.players.map( id => data.players[ id ] ) }
					seats={ data.config.playerCount }
				/>
			) }
			{
				isLobby ? null : data.status === "COMPLETED"
					? <GameStandings results={ data.results } players={ data.players }/>
					: <SeatsView large/>
			}
		</CouchShell>
	);
}
