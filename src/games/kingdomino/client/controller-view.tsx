"use client";

import { RBoard } from "@/games/kingdomino/client/board.tsx";
import { useKingdomino } from "@/games/kingdomino/client/context.tsx";
import { RDomino } from "@/games/kingdomino/client/domino.tsx";
import { RDraft } from "@/games/kingdomino/client/draft.tsx";
import { PickingOrder } from "@/games/kingdomino/client/picking-order.tsx";
import { useKingdominoTurn } from "@/games/kingdomino/client/use-turn.tsx";
import { getDomino } from "@/games/kingdomino/shared/utils.ts";
import { CounterTween } from "@/shared/ui/components/counter-tween.tsx";
import { FloatPlusN } from "@/shared/ui/components/float-plus-n.tsx";
import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { ControllerShell } from "@/swish/client/controller-shell.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { PlayerLobbyGrid } from "@/swish/client/player-lobby.tsx";
import { AddBots, AutoPlayToggle } from "@/swish/client/seat-controls.tsx";
import { StartGame } from "@/swish/client/start-game.tsx";

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
		playerId,
		seat,
		info,
		board,
		isMyTurn,
		canSelect,
		canPlace,
		activeDomino,
		handleDominoSelect,
		placement
	} = useKingdominoTurn();

	const { addBots, startGame, setAutoPlay, isPending } = useKingdomino();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";
	const isSelecting = isPlaying && data.context.phase === "SELECT";
	const autoPlaying = !!playerId && ( data.autoPlay[ playerId ] ?? false );

	const waitingFor = isPlaying ? data.players[ data.context.currentPlayer ]?.name : undefined;
	const points = seat?.score.points ?? 0;

	return (
		<ControllerShell
			game={ "kingdomino" }
			gameId={ data.id }
			code={ data.code }
			isMyTurn={ isLobby || ( isPlaying && ( isMyTurn || canPlace ) ) }
			waitingFor={ waitingFor }
			deadline={ data.deadline }
			completed={ data.status === "COMPLETED" }
			channelId={ data.id }
			persistentActions={ isPlaying && (
				<AutoPlayToggle
					autoPlaying={ autoPlaying }
					setAutoPlay={ setAutoPlay }
					disabled={ isPending }
				/>
			) }
			actions={
				<>
					{ data.status === "CREATED" && (
						<AddBots addBots={ addBots } disabled={ isPending }/>
					) }
					{ data.status === "PLAYERS_READY" && (
						<StartGame startGame={ startGame } disabled={ isPending }/>
					) }
					{ canSelect && (
						<p className={ "font-heading text-center" }>TAP A DOMINO TO CLAIM IT</p>
					) }
					{ canPlace && !!activeDomino && (
						<div className={ "flex gap-2 items-center" }>
							<RDomino domino={ getDomino( activeDomino ) }/>
							{ placement.canDiscard && (
								<Button onClick={ placement.handleDiscard } disabled={ placement.isPending }>
									DISCARD
								</Button>
							) }
						</div>
					) }
				</>
			}
		>
			{ isLobby && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<p className={ "text-lg font-heading text-center" }>YOU&apos;RE SEATED</p>
					<PlayerLobbyGrid players={ data.context.players.map( id => data.players[ id ] ) }/>
				</div>
			) }

			{ isPlaying && !!info && (
				<div className={ "flex flex-col gap-3 w-full" }>
					<div
						className={ cn(
							"grid grid-cols-2 items-center gap-2",
							"bg-background rounded-md p-3"
						) }
					>
						<div className={ "flex items-center gap-2 min-w-0" }>
							<Avatar className={ "rounded-full w-10 h-10 shrink-0" }>
								<AvatarImage src={ info.avatar } alt={ "" } className={ "bg-accent" }/>
							</Avatar>
							<span className={ "truncate font-heading text-lg" }>
								{ info.name.toUpperCase() }
							</span>
						</div>
						<div className={ "flex flex-col items-end relative" }>
							<span className={ "text-[10px] tracking-widest text-muted-foreground" }>POINTS</span>
							<span className={ "font-heading text-3xl leading-none" }>
								<CounterTween value={ points }/>
							</span>
							<FloatPlusN value={ points } className={ "text-base" }/>
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
						<p className={ "text-xs tracking-widest text-muted-foreground self-start" }>
							YOUR KINGDOM
						</p>
						<div className={ "w-full overflow-x-auto" }>
							<div className={ "w-fit mx-auto" }>
								<RBoard
									board={ board }
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
					<GameStandings
						results={ data.results }
						players={ data.players }
						playerId={ playerId }
						scoreLabel={ "POINTS" }
					/>
				</div>
			) }
		</ControllerShell>
	);
}
