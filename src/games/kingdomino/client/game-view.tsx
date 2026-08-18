"use client";

import { Fragment } from "react";

import { ActionPanel } from "@/games/kingdomino/client/action-panel.tsx";
import { RBoard } from "@/games/kingdomino/client/board.tsx";
import { useKingdomino } from "@/games/kingdomino/client/context.tsx";
import { RDomino } from "@/games/kingdomino/client/domino.tsx";
import { RDraft } from "@/games/kingdomino/client/draft.tsx";
import { PickingOrder } from "@/games/kingdomino/client/picking-order.tsx";
import { PlayerScore } from "@/games/kingdomino/client/player-score.tsx";
import { useKingdominoTurn } from "@/games/kingdomino/client/use-turn.tsx";
import { getDomino } from "@/games/kingdomino/shared/utils.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { GameInfo } from "@/swish/client/game-info.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { GameStatusPanel } from "@/swish/client/game-status-panel.tsx";
import { PlayerLobbyGrid } from "@/swish/client/player-lobby.tsx";
import { AddBots } from "@/swish/client/seat-controls.tsx";
import { StartGame } from "@/swish/client/start-game.tsx";
import { StatBlock } from "@/swish/client/stat-block.tsx";
import { TurnBanner } from "@/swish/client/turn-banner.tsx";

import type { PlayerId } from "@/swish/shared/schema.ts";

export function GameView() {
	const {
		data,
		playerId,
		seated,
		board,
		isMyTurn,
		canSelect,
		canPlace,
		activeDomino,
		handleDominoSelect,
		placement
	} = useKingdominoTurn();

	const { addBots, startGame, isPending } = useKingdomino();

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const nonBotPlayers = data.context.players.filter( pid => !data.players[ pid ].isBot );

	const isWinner = ( pid: PlayerId ) => data.results?.ranking.some(
		s => s.playerId === pid && s.rank === 1
	) ?? false;

	return (
		<div className={ "flex flex-col gap-3 w-full max-w-6xl" }>
			<GameInfo
				id={ data.id }
				code={ data.code }
				name={ "kingdomino" }
				additionalInfo={
					<Fragment>
						<StatBlock label={ "BOARD" }>
							{ data.config.boardSize }x{ data.config.boardSize }
						</StatBlock>
						<StatBlock label={ "PLAYERS" }>{ data.config.playerCount }</StatBlock>
					</Fragment>
				}
				completed={ data.status === "COMPLETED" }
				deadline={ data.deadline }
				couchSupport
				showChat={ nonBotPlayers.length > 1 }
			/>
			{ isLobby ? (
				<Fragment>
					<PlayerLobbyGrid players={ data.context.players.map( id => data.players[ id ] ) }/>
					<GameStatusPanel
						status={ data.status }
						seated={ data.context.players.length }
						playerCount={ data.config.playerCount }
					>
						{ data.status === "CREATED" && seated && (
							<AddBots addBots={ addBots } disabled={ isPending }/>
						) }
						{ data.status === "PLAYERS_READY" && seated && (
							<StartGame startGame={ startGame } disabled={ isPending }/>
						) }
					</GameStatusPanel>
				</Fragment>
			) : (
				<div
					className={ cn(
						"grid grid-cols-2 gap-2 justify-between",
						data.status === "COMPLETED" && "grid-cols-1 md:grid-cols-2"
					) }
				>
					{ !!data.results && (
						<div className={ "col-span-2" }>
							<GameStandings
								results={ data.results }
								players={ data.players }
								playerId={ playerId }
								scoreLabel={ "POINTS" }
							/>
						</div>
					) }
					<div className={ "col-span-2" }>
						<TurnBanner
							status={ data.status }
							players={ data.players }
							currentPlayer={ data.context.currentPlayer }
							isMyTurn={ isMyTurn }
							action={ data.context.phase === "SELECT" ? "PICKING A DOMINO" : "PLACING" }
						/>
					</div>
					{ data.context.players.map( pid => {
						const other = data.view.playerData[ pid ];
						const otherInfo = data.players[ pid ];
						if ( !other || !otherInfo ) {
							return null;
						}

						return (
							<PlayerScore
								key={ pid }
								player={ { ...otherInfo, ...other } }
								showBoard={ data.status === "COMPLETED" }
								isWinner={ isWinner( pid ) }
							/>
						);
					} ) }
					{ data.status === "IN_PROGRESS" && (
						// The kingdom and the round's draft stand side by side, so the
						// board a domino is going onto and the dominoes on offer are on
						// screen together rather than a scroll apart.
						<div className={ "col-span-2 min-w-0 flex flex-col md:flex-row gap-2 items-stretch" }>
							{ !!seated && (
								<div
									className={ cn(
										"min-w-0 flex-1 flex flex-col gap-2",
										"bg-background p-2 items-center rounded-md"
									) }
								>
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
								</div>
							) }
							<RDraft
								draft={ data.view.draft }
								players={ data.players }
								active={ canSelect }
								vertical
								onSelect={ handleDominoSelect }
								className={ "md:max-w-xs shrink-0" }
							/>
						</div>
					) }
					{ data.status !== "COMPLETED" && <PickingOrder className={ "col-span-2" }/> }
					{ /* Spanning both columns so the bar's own spacer clears the whole grid. */ }
					<div className={ "col-span-2" }>
						<ActionPanel/>
					</div>
				</div>
			) }
		</div>
	);
}
