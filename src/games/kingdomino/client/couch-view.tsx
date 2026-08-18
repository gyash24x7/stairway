"use client";

import { useKingdomino } from "@/games/kingdomino/client/context.tsx";
import { RDraft } from "@/games/kingdomino/client/draft.tsx";
import { kingdomBoardSize, KingdomTile } from "@/games/kingdomino/client/kingdom-tile.tsx";
import { PickingOrder } from "@/games/kingdomino/client/picking-order.tsx";
import { CouchLobby } from "@/swish/client/couch-lobby.tsx";
import { CouchShell } from "@/swish/client/couch-shell.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { StatBlock } from "@/swish/client/stat-block.tsx";
import { turnText } from "@/swish/client/turn-banner.tsx";

/**
 * The shared screen. Kingdomino hides nothing but the undrawn deck, so the
 * television can show the whole table: every kingdom on the centre stage, and the
 * round's draft — including who has taken what — down the rail.
 */
export function CouchView() {
	const { data } = useKingdomino();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";
	const isCompleted = data.status === "COMPLETED";

	const players = data.context.players;
	const boardSize = kingdomBoardSize( players.length, data.config.boardSize );

	const turn = turnText( {
		status: data.status,
		players: data.players,
		currentPlayer: data.context.currentPlayer,
		action: data.context.phase === "SELECT" ? "PICKING A DOMINO" : "PLACING",
		seated: players.length,
		playerCount: data.config.playerCount,
		couch: true
	} );

	return (
		<CouchShell
			game={ "kingdomino" }
			code={ data.code }
			turn={ turn }
			deadline={ data.deadline }
			currentPlayer={ data.status === "IN_PROGRESS" ? data.context.currentPlayer : undefined }
			players={ data.players }
			stretch={ !isLobby }
			headerInfo={
				<div className={ "flex gap-12" }>
					<StatBlock label={ "BOARD" } large>
						{ data.config.boardSize }x{ data.config.boardSize }
					</StatBlock>
					<StatBlock label={ "PLAYERS" } large>{ data.config.playerCount }</StatBlock>
				</div>
			}
			seats={
				isPlaying ? (
					<>
						<PickingOrder large/>
						<p className={ "text-metric-label-lg shrink-0" }>DRAFT</p>
						<RDraft draft={ data.view.draft } players={ data.players } large/>
					</>
				) : isCompleted ? (
					players.map( pid => (
						<KingdomTile key={ pid } playerId={ pid } showQueue={ false } showBoard={ false }/>
					) )
				) : null
			}
		>
			{ isLobby && (
				<CouchLobby
					players={ players.map( id => data.players[ id ] ) }
					seats={ data.config.playerCount }
				/>
			) }
			{ isPlaying && (
				<div className={ "h-full min-h-0 w-full grid grid-cols-2 gap-4 auto-rows-fr" }>
					{ players.map( pid => (
						<KingdomTile key={ pid } playerId={ pid } size={ boardSize }/>
					) ) }
				</div>
			) }
			{ isCompleted && (
				// Sized to its rows and centred, not stretched: a two-seat table has two
				// of them, and filling the stage would give each a row taller than a
				// kingdom.
				<div className={ "w-full max-h-full overflow-hidden flex items-center" }>
					<GameStandings
						results={ data.results }
						players={ data.players }
						scoreLabel={ "POINTS" }
						large
					/>
				</div>
			) }
		</CouchShell>
	);
}
