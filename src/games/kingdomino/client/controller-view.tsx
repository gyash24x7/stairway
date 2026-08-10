"use client";

import { DOMINO_DECK } from "@/games/kingdomino/shared/utils.ts";
import { CounterTween } from "@/shared/ui/components/counter-tween.tsx";
import { FloatPlusN } from "@/shared/ui/components/float-plus-n.tsx";
import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { PlayerLobbyGrid } from "@/shared/ui/components/player-lobby.tsx";
import { StartGame } from "@/shared/ui/components/start-game.tsx";
import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { ControllerShell } from "@/shared/ui/couch/controller-shell.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { RBoard } from "@/games/kingdomino/client/board.tsx";
import { startGameFn } from "@/games/kingdomino/client/client.ts";
import { RDomino } from "@/games/kingdomino/client/domino.tsx";
import { RDraft } from "@/games/kingdomino/client/draft.tsx";
import { PickingOrder } from "@/games/kingdomino/client/picking-order.tsx";
import { useKingdominoTurn } from "@/games/kingdomino/client/use-turn.tsx";

/**
 * The phone half. Every kingdom, every score and the turn order are on the
 * television; what stays here is the one board you can actually place on, the
 * draft while you're picking, and the two things you can do about them.
 *
 * The rules come from `useKingdominoTurn`, the same hook the full page uses — the
 * controller is a different layout, not a different game.
 */
export function ControllerView() {
	const {
		data,
		player,
		isMyTurn,
		myPlayerInfo,
		canSelect,
		canPlace,
		activeDomino,
		handleDominoSelect,
		placement
	} = useKingdominoTurn();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";
	const isSelecting = isPlaying && data.context.phase === "SELECT";

	const waitingFor = isPlaying
		? data.players[ data.context.currentPlayer ]?.name
		: undefined;

	return (
		<ControllerShell
			game={ "kingdomino" }
			code={ data.code }
			isMyTurn={ data.status === "PLAYERS_READY" || ( isPlaying && ( isMyTurn || canPlace ) ) }
			waitingFor={ waitingFor }
			channelId={ data.id }
			actions={
				<>
					{ data.status === "PLAYERS_READY" && (
						<StartGame
							gameId={ data.id }
							queryKey={ [ "kingdomino", "getState", data.id ] }
							startGame={ startGameFn }
						/>
					) }
					{ canSelect && (
						<p className={ "font-heading text-center" }>TAP A DOMINO TO CLAIM IT</p>
					) }
					{ canPlace && !!activeDomino && (
						<div className={ "flex gap-3 items-center" }>
							<RDomino domino={ DOMINO_DECK[ activeDomino - 1 ] }/>
							{ placement.canDiscard ? (
								<Button onClick={ placement.handleDiscard } disabled={ placement.isPending }>
									DISCARD
								</Button>
							) : (
								<p className={ "font-heading text-sm" }>TAP YOUR BOARD TO PLACE</p>
							) }
						</div>
					) }
				</>
			}
		>
			{ isLobby && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<p className={ "text-lg font-heading text-center" }>YOU'RE SEATED</p>
					<PlayerLobbyGrid players={ data.context.players.map( id => data.players[ id ] ) }/>
				</div>
			) }

			{ isPlaying && (
				<div className={ "flex flex-col gap-3 w-full" }>
					{ /*
					  * Just who I am and where I stand. Every other seat's score is on the
					  * television, and `PlayerScore` would repeat the kingdom that already
					  * fills the rest of this screen.
					  */ }
					<div
						className={ cn(
							"grid grid-cols-2 items-center gap-2",
							"bg-background rounded-md p-3"
						) }
					>
						<div className={ "flex items-center gap-2 min-w-0" }>
							<Avatar className={ "rounded-full w-10 h-10 shrink-0" }>
								<AvatarImage src={ myPlayerInfo.avatar } alt={ "" } className={ "bg-accent" }/>
							</Avatar>
							<span className={ "truncate font-heading text-lg" }>
								{ myPlayerInfo.name.toUpperCase() }
							</span>
						</div>
						<div className={ "flex flex-col items-end relative" }>
							<span className={ "text-[10px] tracking-widest text-foreground/70" }>
								POINTS
							</span>
							<span className={ "font-heading text-3xl leading-none" }>
								<CounterTween value={ myPlayerInfo.score.points ?? 0 }/>
							</span>
							<FloatPlusN
								value={ myPlayerInfo.score.points ?? 0 }
								className={ "text-base" }
							/>
						</div>
					</div>

					{ isSelecting && (
						<>
							<PickingOrder/>
							<RDraft
								draft={ data.view.draft }
								players={ data.players }
								active={ canSelect }
								compact
								onSelect={ handleDominoSelect }
							/>
						</>
					) }
					<div className={ "flex flex-col gap-2 items-center bg-background p-2 rounded-md" }>
						<p className={ "text-xs tracking-widest text-foreground/70 self-start" }>
							YOUR KINGDOM
						</p>
						<div className={ "w-full overflow-x-auto" }>
							<div className={ "w-fit mx-auto" }>
								<RBoard
									board={ myPlayerInfo.board }
									boardSize={ data.config.boardSize }
									isActive={ canPlace }
									onCellClick={ canPlace ? placement.handleCellClick : undefined }
									activeDominoId={ activeDomino }
									getPreviewCoords={ canPlace ? placement.getPreviewCoords : undefined }
									tentative={ placement.tentativeProp }
								/>
							</div>
						</div>
					</div>
				</div>
			) }

			{ data.status === "COMPLETED" && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<p className={ "text-lg font-heading" }>GAME OVER</p>
					<GameStandings
						results={ data.results }
						players={ data.players }
						playerId={ player.playerId }
						scoreLabel={ "POINTS" }
					/>
				</div>
			) }
		</ControllerShell>
	);
}
