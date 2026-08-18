"use client";

import { Board } from "@/games/splendor/client/board.tsx";
import { useSplendor } from "@/games/splendor/client/context.tsx";
import { PlayerInfo } from "@/games/splendor/client/player-info.tsx";
import { PlayerTableau } from "@/games/splendor/client/player-tableau.tsx";
import { TokenBar } from "@/games/splendor/client/token-bar.tsx";
import { CouchLobby } from "@/swish/client/couch-lobby.tsx";
import { CouchShell } from "@/swish/client/couch-shell.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { StatBlock } from "@/swish/client/stat-block.tsx";
import { turnText } from "@/swish/client/turn-banner.tsx";

/**
 * The shared screen. Renders the same `Board`/`PlayerInfo` components the phone
 * uses — no `renderCard`, no `reservedSlot`, so every one of them is read-only —
 * scaled up by `CouchShell`'s design canvas.
 */
export function CouchView() {
	const { data } = useSplendor();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";

	const isLastRound = isPlaying && Object.values( data.view.playerData )
		.some( p => p.points >= data.config.winningPoints );

	const turn = turnText( {
		status: data.status,
		players: data.players,
		currentPlayer: data.context.currentPlayer,
		note: isLastRound ? "LAST ROUND!" : undefined,
		seated: data.context.players.length,
		playerCount: data.config.playerCount,
		couch: true
	} );

	return (
		<CouchShell
			game={ "splendor" }
			code={ data.code }
			turn={ turn }
			deadline={ data.deadline }
			currentPlayer={ data.status === "IN_PROGRESS" ? data.context.currentPlayer : undefined }
			players={ data.players }
			stretch={ !isLobby }
			headerInfo={
				<StatBlock label={ "WINNING POINTS" } large>{ data.config.winningPoints }</StatBlock>
			}
			seats={
				isLobby ? null : data.status === "COMPLETED"
					? (
						<GameStandings
							results={ data.results }
							players={ data.players }
							scoreLabel={ "POINTS" }
						/>
					)
					: (
						<>
							<TokenBar
								tokens={ data.view.tokens }
								tokenText={ "TOKENS" }
								onTokenClick={ () => undefined }
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
					players={ data.context.players.map( id => data.players[ id ] ) }
					seats={ data.config.playerCount }
				/>
			) }
			{ isPlaying && <Board fill/> }
			{ data.status === "COMPLETED" && (
				<div className={ "h-full min-h-0 w-full grid grid-cols-2 gap-4 auto-rows-fr" }>
					{ data.context.players.map( p => (
						<PlayerTableau playerId={ p } key={ p } large/>
					) ) }
				</div>
			) }
		</CouchShell>
	);
}
