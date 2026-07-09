"use client";

import { RBoard } from "@/kingdomino/components/board";
import { useKingdomino } from "@/kingdomino/components/context";
import { RDomino } from "@/kingdomino/components/domino";
import { RDraft } from "@/kingdomino/components/draft";
import { PlayerBoards } from "@/kingdomino/components/player-boards";
import { PlayerScore } from "@/kingdomino/components/player-score";
import { usePlacement } from "@/kingdomino/components/use-placement";
import { orpc } from "@/api/query";
import type { DominoId } from "@s2h/kingdomino-core/types";
import { DOMINO_DECK } from "@s2h/kingdomino-core/utils";
import { GameInfo } from "@/shared/components/game-info";
import { PlayerLobbyGrid } from "@/shared/components/player-lobby";
import { Button } from "@/shared/primitives/button";
import { cn } from "@s2h/shared/utils/cn";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useState } from "react";

export function GameView() {
	const { shared, player } = useKingdomino();

	const isMyTurn = shared.status === "IN_PROGRESS"
		&& shared.context.currentPlayer === player.playerId;
	const isLobby = shared.status === "CREATED" || shared.status === "PLAYERS_READY";

	const myPlayerInfo = {
		...shared.players[ player.playerId ],
		...shared.state.playerData[ player.playerId ]
	};

	const queryClient = useQueryClient();
	const selectDomino = useMutation( orpc.kingdomino.selectDomino.mutationOptions( {
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: orpc.kingdomino.getGame.key( { input: { gameId: shared.id } } )
		} )
	} ) );
	const isSelectPending = selectDomino.isPending;
	const [ selectedDominoId, setSelectedDominoId ] = useState<DominoId | null>( null );

	const canSelect = isMyTurn && shared.context.phase === "SELECT" && !isSelectPending;
	const canPlace = shared.status === "IN_PROGRESS"
		&& shared.context.phase === "PLACE"
		&& myPlayerInfo.queue.length > 0;
	const activeDomino = selectedDominoId
		?? ( canPlace ? myPlayerInfo.queue.toSorted( ( a, b ) => a - b )[ 0 ] : null );

	const handleDominoSelect = ( dominoId: DominoId ) => {
		if ( !canSelect ) {
			return;
		}
		selectDomino.mutate( { gameId: shared.id, dominoId } );
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
			case "IN_PROGRESS": {
				if ( shared.context.phase === "SELECT" ) {
					const currentName = shared.players[ shared.context.currentPlayer ]?.name;
					return isMyTurn
						? "YOUR TURN TO PICK"
						: `${ currentName?.toUpperCase() ?? "OPPONENT" } IS PICKING`;
				}
				return "PLACEMENT IN PROGRESS";
			}
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
				<div
					className={ cn(
						"grid grid-cols-2 gap-2 justify-between mb-52",
						shared.status === "COMPLETED" && "grid-cols-1 md:grid-cols-2"
					) }
				>
					<PlayerScore
						player={ myPlayerInfo }
						showBoard={ shared.status === "COMPLETED" }
						isWinner={ shared.state.winner === myPlayerInfo.id }
					/>
					{ shared.context.players.filter( pid => pid !== myPlayerInfo.id ).map( pid => (
						<PlayerScore
							key={ pid }
							player={ {
								...shared.players[ pid ],
								...shared.state.playerData[ pid ]
							} }
							showBoard={ shared.status === "COMPLETED" }
							isWinner={ shared.state.winner === pid }
						/>
					) ) }
					{ shared.status === "IN_PROGRESS" && (
						<div
							className={ cn(
								"col-span-2 min-w-0 flex flex-col gap-2",
								"bg-background p-2 items-center rounded-md"
							) }
						>
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
						</div>
					) }
					<div
						className={ cn(
							"col-span-2 p-2 w-full rounded-md bg-accent text-center overflow-hidden",
							shared.status === "COMPLETED" && "col-span-1 md:col-span-2"
						) }
					>
						<AnimatePresence mode={ "wait" }>
							<motion.span
								key={ getStatusMsg() }
								className={ "text-2xl font-heading inline-block" }
								initial={ { opacity: 0, scale: 0.7 } }
								animate={ { opacity: 1, scale: 1 } }
								exit={ { opacity: 0, scale: 0.7 } }
								transition={ { type: "spring", stiffness: 380, damping: 22 } }
							>
								{ getStatusMsg() }
							</motion.span>
						</AnimatePresence>
					</div>
					{ shared.status !== "COMPLETED" && (
						<Fragment>
							<RDraft
								draft={ shared.state.draft }
								players={ shared.players }
								active={ canSelect }
								onSelect={ handleDominoSelect }
							/>
							<div className={ "col-span-2" }>
								<PlayerBoards/>
							</div>
						</Fragment>
					) }
				</div>
			) }
		</div>
	);
}
