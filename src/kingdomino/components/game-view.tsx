"use client";

import { RBoard } from "@/kingdomino/components/board";
import { useKingdomino } from "@/kingdomino/components/context";
import { RDomino } from "@/kingdomino/components/domino";
import { RDraft } from "@/kingdomino/components/draft";
import { PlayerBoards } from "@/kingdomino/components/player-boards";
import { PlayerScore } from "@/kingdomino/components/player-score";
import { usePlacement } from "@/kingdomino/components/use-placement";
import { selectDomino } from "@/kingdomino/core/actions";
import type { DominoId } from "@/kingdomino/core/types";
import { DOMINO_DECK } from "@/kingdomino/core/utils";
import { GameInfo } from "@/shared/components/game-info";
import { PlayerLobbyGrid } from "@/shared/components/player-lobby";
import { Button } from "@/shared/primitives/button";
import { cn } from "@/shared/utils/cn";
import { Fragment, useState, useTransition } from "react";

export function GameView() {
	const { shared, player } = useKingdomino();

	const isMyTurn = shared.status === "IN_PROGRESS"
		&& shared.context.currentPlayer === player.playerId;
	const isLobby = shared.status === "CREATED" || shared.status === "PLAYERS_READY";

	const myPlayerInfo = {
		...shared.players[ player.playerId ],
		...shared.state.playerData[ player.playerId ]
	};

	const [ isSelectPending, startSelectTransition ] = useTransition();
	const [ selectedDominoId, setSelectedDominoId ] = useState<DominoId | null>( null );

	const canSelect = isMyTurn && shared.context.phase === "SELECT" && !isSelectPending;
	const canPlace = isMyTurn && shared.context.phase === "PLACE";
	const activeDomino = selectedDominoId
		?? ( canPlace ? myPlayerInfo.queue.toSorted( ( a, b ) => a - b )[ 0 ] : null );

	const handleDominoSelect = ( dominoId: DominoId ) => {
		if ( !canSelect ) {
			return;
		}
		startSelectTransition( async () => {
			await selectDomino( { gameId: shared.id, dominoId } );
		} );
	};

	const placement = usePlacement( {
		gameId: shared.id,
		board: myPlayerInfo.board,
		activeDominoId: activeDomino,
		canPlace: canPlace && !isSelectPending,
		onClear: () => setSelectedDominoId( null )
	} );

	const getStatusMsg = () => {
		switch ( shared.status ) {
			case "CREATED":
				return "WAITING FOR PLAYERS...";
			case "PLAYERS_READY":
				return "WAITING FOR GAME TO START...";
			case "COMPLETED":
				return shared.state.winner
					? `WINNER: ${ shared.players[ shared.state.winner ].name }`
					: `CHECKING WINNER`;
			case "IN_PROGRESS":
				return shared.context.phase === "SELECT"
					? "SELECTION IN PROGRESS"
					: "PLACEMENT IN PROGRESS";
		}
	};

	return (
		<div className={ "flex flex-col gap-3 w-full max-w-6xl" }>
			<GameInfo
				code={ shared.code }
				name={ "kingdomino" }
				additionalInfo={
					<Fragment>
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>BOARD</p>
							<h1 className={ "text-2xl md:text-4xl font-heading" }>
								{ shared.config.boardSize }x{ shared.config.boardSize }
							</h1>
						</div>
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>PLAYERS</p>
							<h1 className={ "text-2xl md:text-4xl font-heading" }>
								{ shared.config.playerCount }
							</h1>
						</div>
					</Fragment>
				}
				completed={ shared.status === "COMPLETED" }
			/>
			{ isLobby ? (
				<Fragment>
					<PlayerLobbyGrid players={ shared.context.players.map( id => shared.players[ id ] ) }/>
					<div className={ "p-2 w-full rounded-md bg-accent text-center" }>
						<span className={ "text-2xl font-heading" }>{ getStatusMsg() }</span>
					</div>
				</Fragment>
			) : (
				<div className={ "grid grid-cols-2 gap-2 justify-between mb-52" }>
					<PlayerScore player={ myPlayerInfo }/>
					{ shared.context.players.filter( pid => pid !== myPlayerInfo.id ).map( pid => (
						<PlayerScore
							key={ pid }
							player={ {
								...shared.players[ pid ],
								...shared.state.playerData[ pid ]
							} }
						/>
					) ) }
					<div
						className={ cn(
							"col-span-2 min-w-0 flex flex-col gap-2",
							"bg-background p-2 items-center rounded-md"
						) }
					>
						{ shared.status === "IN_PROGRESS" && (
							<Fragment>
								<div className={ "w-full overflow-x-auto" }>
									<div className={ "w-fit mx-auto" }>
										<RBoard
											board={ myPlayerInfo.board }
											boardSize={ shared.config.boardSize }
											isActive={ canPlace }
											onCellClick={ canPlace ? placement.handleCellClick : undefined }
											activeDominoId={ activeDomino }
											getPreviewCoords={ canPlace ? placement.getPreviewCoords : undefined }
											tentative={ placement.tentativeProp }
										/>
									</div>
								</div>
								{ canPlace && activeDomino && (
									<div className={ "flex gap-2 items-center" }>
										<RDomino domino={ DOMINO_DECK[ activeDomino - 1 ] }/>
										{ placement.canDiscard && (
											<Button
												onClick={ placement.handleDiscard }
												disabled={ placement.isPending }
											>
												Discard
											</Button>
										) }
									</div>
								) }
							</Fragment>
						) }
					</div>
					<div className={ "col-span-2 p-2 w-full rounded-md bg-accent text-center" }>
						<span className={ "text-2xl font-heading" }>{ getStatusMsg() }</span>
					</div>
					<RDraft
						draft={ shared.state.draft }
						players={ shared.players }
						active={ canSelect }
						onSelect={ handleDominoSelect }
					/>
					<div className={ "col-span-2" }>
						<PlayerBoards/>
					</div>
				</div>
			) }
		</div>
	);
}
