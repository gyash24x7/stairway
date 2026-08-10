"use client";

import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { CouchLobby } from "@/shared/ui/couch/couch-lobby.tsx";
import { CouchShell } from "@/shared/ui/couch/couch-shell.tsx";
import { useKingdominoTable } from "@/games/kingdomino/client/context.tsx";
import { RDraft } from "@/games/kingdomino/client/draft.tsx";
import { KingdomTile, kingdomBoardSize } from "@/games/kingdomino/client/kingdom-tile.tsx";
import { PickingOrder } from "@/games/kingdomino/client/picking-order.tsx";

/**
 * The shared screen. Kingdomino hides nothing but the undrawn deck, so the
 * television can show the whole table: every kingdom on the centre stage, and the
 * round's draft — including who has taken what — down the rail.
 */
export function CouchView() {
	const { data } = useKingdominoTable();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";
	const isCompleted = data.status === "COMPLETED";

	const players = data.context.players;
	const boardSize = kingdomBoardSize( players.length, data.config.boardSize );

	const currentName = ( data.players[ data.context.currentPlayer ]?.name ?? "" ).toUpperCase();

	const turn = isLobby
		? ( data.status === "CREATED" ? "WAITING FOR PLAYERS" : "START FROM ANY PHONE" )
		: isPlaying
			? ( data.context.phase === "SELECT"
				? `${ currentName } IS PICKING A DOMINO`
				: `${ currentName } IS PLACING` )
			: "GAME OVER";

	return (
		<CouchShell
			game={ "kingdomino" }
			code={ data.code }
			turn={ turn }
			stretch={ !isLobby }
			headerInfo={
				<div className={ "flex gap-12 justify-center" }>
					<div className={ "text-center" }>
						<p className={ "text-2xl tracking-widest text-foreground/70" }>BOARD</p>
						<p className={ "text-6xl font-heading leading-none" }>
							{ data.config.boardSize }x{ data.config.boardSize }
						</p>
					</div>
					<div className={ "text-center" }>
						<p className={ "text-2xl tracking-widest text-foreground/70" }>PLAYERS</p>
						<p className={ "text-6xl font-heading leading-none" }>
							{ data.config.playerCount }
						</p>
					</div>
				</div>
			}
			// In play the rail carries the draft — the one shared decision everyone is
			// waiting on. Once it's over the standings take the stage and the rail
			// keeps the faces around the table; four kingdoms will not fit a third of
			// the screen at a size anyone could read from a sofa.
			seats={
				isPlaying ? (
					<>
						<PickingOrder large/>
						<p className={ "text-2xl tracking-widest text-foreground/70 shrink-0" }>
							DRAFT
						</p>
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
					game={ "kingdomino" }
					code={ data.code }
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
				<GameStandings
					results={ data.results }
					players={ data.players }
					scoreLabel={ "POINTS" }
					large
					className={ "h-full" }
				/>
			) }
		</CouchShell>
	);
}
