import * as HashSet from "effect/HashSet";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { cn } from "cn";

import type { KingdominoConfig, KingdominoView } from "@/games/kingdomino/schema";
import { RBoard } from "@/games/kingdomino/ui/board";
import {
	addBotsAtom,
	autoPlayAtom,
	discardDominoAtom,
	placeDominoAtom,
	rematchAtom,
	selectDominoAtom,
	startGameAtom
} from "@/games/kingdomino/ui/client";
import { RDomino } from "@/games/kingdomino/ui/domino";
import { RDraft } from "@/games/kingdomino/ui/draft";
import { KingdominoHint } from "@/games/kingdomino/ui/hint";
import { PickingOrder } from "@/games/kingdomino/ui/picking-order";
import { useKingdominoTurn } from "@/games/kingdomino/ui/use-turn";
import { getDomino } from "@/games/kingdomino/utils";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import { Button } from "@/shared/primitives/button";
import { CounterTween } from "@/shared/shell/counter-tween";
import { FloatPlusN } from "@/shared/shell/float-plus-n";
import type { GameView } from "@/swish/schema";
import { AutoPlayInput, GameId } from "@/swish/schema";
import { ControllerShell } from "@/swish/ui/controller-shell";
import { GameStandings } from "@/swish/ui/game-standings";
import { PlayerLobbyGrid } from "@/swish/ui/player-lobby";
import { RematchPanel } from "@/swish/ui/rematch";
import { AddBots, AutoPlayToggle, StartGame } from "@/swish/ui/seat-controls";

type Game = GameView<KingdominoView, KingdominoConfig>;

export type ControllerViewProps = {
	readonly game: Game;
	readonly gameId: string;
};

/**
 * The phone half. Every kingdom, every score and the turn order are on the
 * television; what stays here is the one board you can actually place on, the
 * draft while you're picking, and the two things you can do about them.
 *
 * The rules come from `useKingdominoTurn`, the same hook the full page uses — the
 * controller is a different layout, not a different game.
 */
export function ControllerView( { game, gameId }: ControllerViewProps ) {
	const params = { gameId: GameId.make( gameId ) };

	const addBots = useAtomSet( addBotsAtom, { mode: "promiseExit" } );
	const start = useAtomSet( startGameAtom, { mode: "promiseExit" } );
	const setAutoPlay = useAtomSet( autoPlayAtom, { mode: "promiseExit" } );
	const selectDomino = useAtomSet( selectDominoAtom, { mode: "promiseExit" } );
	const placeDomino = useAtomSet( placeDominoAtom, { mode: "promiseExit" } );
	const discardDomino = useAtomSet( discardDominoAtom, { mode: "promiseExit" } );

	const adding = useAtomValue( addBotsAtom ).waiting;
	const starting = useAtomValue( startGameAtom ).waiting;
	const switching = useAtomValue( autoPlayAtom ).waiting;
	const isSelectPending = useAtomValue( selectDominoAtom ).waiting;
	const isDiscardPending = useAtomValue( discardDominoAtom ).waiting;
	const isPlacePending = useAtomValue( placeDominoAtom ).waiting || isDiscardPending;

	const isPending = adding || starting || switching || isSelectPending || isPlacePending;

	const playerId = game.view.playerId;

	const {
		seat,
		info,
		board,
		isMyTurn,
		canSelect,
		canPlace,
		activeDomino,
		handleDominoSelect,
		placement
	} = useKingdominoTurn( {
		data: game,
		playerId,
		selectDomino: input => selectDomino( { params, payload: input } ),
		placeDomino: input => placeDomino( { params, payload: input } ),
		discardDomino: input => discardDomino( { params, payload: input } ),
		isSelectPending,
		isPlacePending
	} );

	// `getDomino` is a lookup into the fixed deck, so it can miss on an id the
	// client has not caught up with. Resolved once here rather than at each use.
	const activeDominoTile = activeDomino ? getDomino( activeDomino ) : undefined;

	const hasSeat = !!playerId;
	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
	const isPlaying = game.status === "IN_PROGRESS";
	const isSelecting = isPlaying && game.context.phase === "SELECT";
	const autoPlaying = !!playerId && HashSet.has( game.runtime.autoPlay, playerId );

	const waitingFor = isPlaying && game.context.currentPlayer
		? game.players[ game.context.currentPlayer ]?.name
		: undefined;
	const points = seat?.score.points ?? 0;

	return (
		<ControllerShell
			game={ "kingdomino" }
			deadline={ game.runtime.deadline }
			isMyTurn={ isLobby || ( isPlaying && ( isMyTurn || canPlace ) ) }
			waitingFor={ waitingFor }
			completed={ game.status === "COMPLETED" }
			persistentActions={ isPlaying && hasSeat && (
				<>
					<AutoPlayToggle
						autoPlaying={ autoPlaying }
						setAutoPlay={ enabled => void setAutoPlay( {
							params,
							payload: AutoPlayInput.make( { enabled } )
						} ) }
						disabled={ isPending }
					/>
					<KingdominoHint gameId={ gameId } disabled={ !isMyTurn && !canPlace }/>
				</>
			) }
			actions={
				<>
					{ hasSeat && game.status === "CREATED" && (
						<AddBots
							addBots={ () => void addBots( { params } ) }
							disabled={ isPending }
						/>
					) }
					{ hasSeat && game.status === "PLAYERS_READY" && (
						<StartGame
							startGame={ () => void start( { params } ) }
							disabled={ isPending }
						/>
					) }
					{ canSelect && (
						<p className={ "font-heading text-center" }>TAP A DOMINO TO CLAIM IT</p>
					) }
					{ canPlace && !!activeDominoTile && (
						<div className={ "flex gap-2 items-center" }>
							<RDomino domino={ activeDominoTile }/>
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
					<PlayerLobbyGrid
						players={ game.context.players
							.map( id => game.players[ id ] )
							.filter( p => !!p ) }
						seats={ game.config.playerCount }
					/>
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
							<PickingOrder data={ game }/>
							<RDraft
								draft={ game.view.draft }
								players={ game.players }
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
									boardSize={ game.config.boardSize }
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

			{ game.status === "COMPLETED" && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<GameStandings
						results={ game.results }
						players={ game.players }
						playerId={ playerId }
						scoreLabel={ "POINTS" }
					/>
					<RematchPanel
						game={ "kingdomino" }
						gameId={ game.id }
						status={ game.status }
						rematch={ game.runtime.rematch }
						seated={ hasSeat }
						rematchAtom={ rematchAtom }
						surface={ "controller" }
					/>
				</div>
			) }
		</ControllerShell>
	);
}
