"use client";

import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { CouchLobby } from "@/shared/ui/couch/couch-lobby.tsx";
import { CouchShell } from "@/shared/ui/couch/couch-shell.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { Board } from "@/games/splendor/client/board.tsx";
import { useSplendorTable } from "@/games/splendor/client/context.tsx";
import { PlayerInfo } from "@/games/splendor/client/player-info.tsx";
import { PlayerTableau } from "@/games/splendor/client/player-tableau.tsx";
import { TokenBar } from "@/games/splendor/client/token-bar.tsx";

/**
 * The shared screen. Renders the same `Board`/`PlayerInfo` components the phone
 * uses — no `renderCard`, no `reservedSlot`, so every one of them is read-only —
 * scaled up by `CouchShell`'s design canvas.
 */
export function CouchView() {
	const { data } = useSplendorTable();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";

	const isLastRound = isPlaying && Object.values( data.view.playerData )
		.some( p => p.points >= data.config.winningPoints );

	const currentName = data.players[ data.context.currentPlayer ]?.name;

	const turn = isLobby
		? ( data.status === "CREATED" ? "WAITING FOR PLAYERS" : "START FROM ANY PHONE" )
		: isPlaying
			? `${ ( currentName ?? "" ).toUpperCase() }'S TURN${ isLastRound ? " — LAST ROUND!" : "" }`
			: "GAME OVER";

	return (
		<CouchShell
			game={ "splendor" }
			code={ data.code }
			turn={ turn }
			stretch={ !isLobby }
			headerInfo={
				<div className={ "text-center" }>
					<p className={ "text-2xl tracking-widest text-foreground/70" }>WINNING POINTS</p>
					<p className={ cn( "text-6xl font-heading leading-none" ) }>
						{ data.config.winningPoints }
					</p>
				</div>
			}
			seats={
				isLobby ? null : data.status === "COMPLETED"
					? data.context.players.map( p => <PlayerTableau playerId={ p } key={ p }/> )
					: (
						<>
							{ /*
							  * The token pool rides in the rail rather than under the board:
							  * the three card rows are height-starved on a 16:9 stage, and
							  * every row this frees goes straight into card size.
							  */ }
							<TokenBar
								tokens={ data.view.tokens }
								tokenText={ "TOKENS" }
								onTokenClick={ () => undefined }
								disabled
								large
							/>
							{ data.context.players.map( p => (
								<PlayerInfo playerId={ p } key={ p } large/>
							) ) }
						</>
					)
			}
		>
			{ isLobby && (
				<CouchLobby
					game={ "splendor" }
					code={ data.code }
					players={ data.context.players.map( id => data.players[ id ] ) }
					seats={ data.config.playerCount }
				/>
			) }
			{ isPlaying && <Board fill/> }
			{ data.status === "COMPLETED" && (
				<GameStandings
					results={ data.results }
					players={ data.players }
					scoreLabel={ "POINTS" }
					large
				/>
			) }
		</CouchShell>
	);
}
