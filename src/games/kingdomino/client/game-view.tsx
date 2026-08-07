"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useState } from "react";

import { DOMINO_DECK } from "@/games/kingdomino/shared/utils.ts";
import { GameInfo } from "@/shared/ui/components/game-info.tsx";
import { PlayerLobbyGrid } from "@/shared/ui/components/player-lobby.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { RBoard } from "@/games/kingdomino/client/board.tsx";
import { selectDominoFn } from "@/games/kingdomino/client/client.ts";
import { useKingdomino } from "@/games/kingdomino/client/context.tsx";
import { RDomino } from "@/games/kingdomino/client/domino.tsx";
import { RDraft } from "@/games/kingdomino/client/draft.tsx";
import { PlayerBoards } from "@/games/kingdomino/client/player-boards.tsx";
import { PlayerScore } from "@/games/kingdomino/client/player-score.tsx";
import { usePlacement } from "@/games/kingdomino/client/use-placement.tsx";
import { startGameFn } from "@/games/kingdomino/client/client.ts";
import { StartGame } from "@/shared/ui/components/start-game.tsx";

export function GameView() {
	const { data } = useKingdomino();
	const player = data.view;

	const isMyTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === player.playerId;
	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";

	const myPlayerInfo = {
		...data.players[ player.playerId ],
		...data.view.playerData[ player.playerId ]
	};

	const queryClient = useQueryClient();
	const selectDomino = useMutation( {
		mutationFn: ( dominoId: number ) => selectDominoFn( data.id, { dominoId } ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "kingdomino", "getState", data.id ]
		} )
	} );

	const isSelectPending = selectDomino.isPending;
	const [ selectednumber, setSelectednumber ] = useState<number | null>( null );

	const canSelect = isMyTurn && data.context.phase === "SELECT" && !isSelectPending;
	const canPlace = data.status === "IN_PROGRESS"
		&& data.context.phase === "PLACE"
		&& myPlayerInfo.queue.length > 0;
	const activeDomino = selectednumber
		?? ( canPlace ? myPlayerInfo.queue.toSorted( ( a, b ) => a - b )[ 0 ] : null );

	const handleDominoSelect = ( number: number ) => {
		if ( !canSelect ) {
			return;
		}
		selectDomino.mutate( number );
	};

	const placement = usePlacement( {
		gameId: data.id,
		board: myPlayerInfo.board,
		activeDominoId: activeDomino,
		canPlace: canPlace && !isSelectPending,
		onClear: () => setSelectednumber( null )
	} );

	const getStatusMsg = () => {
		switch ( data.status ) {
			case "CREATED":
				return "WAITING FOR PLAYERS...";
			case "PLAYERS_READY":
				return "WAITING FOR GAME TO START...";
			case "COMPLETED":
				return data.view.winner
					? `WINNER: ${ data.players[ data.view.winner ].name }`
					: `CHECKING WINNER`;
			case "IN_PROGRESS": {
				if ( data.context.phase === "SELECT" ) {
					const currentName = data.players[ data.context.currentPlayer ]?.name;
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
				code={ data.code }
				name={ "kingdomino" }
				additionalInfo={
					<Fragment>
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>BOARD</p>
							<h1 className={ "text-2xl md:text-4xl font-heading" }>
								{ data.config.boardSize }x{ data.config.boardSize }
							</h1>
						</div>
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>PLAYERS</p>
							<h1 className={ "text-2xl md:text-4xl font-heading" }>
								{ data.config.playerCount }
							</h1>
						</div>
					</Fragment>
				}
				completed={ data.status === "COMPLETED" }
			/>
			{ isLobby ? (
				<Fragment>
					<PlayerLobbyGrid players={ data.context.players.map( id => data.players[ id ] ) }/>
					<div className={ "p-2 w-full rounded-md bg-accent text-center" }>
						<span className={ "text-2xl font-heading" }>{ getStatusMsg() }</span>
					</div>
					{ data.status === "PLAYERS_READY" && (
						<div className={ "flex justify-center w-full" }>
							<StartGame
								gameId={ data.id }
								queryKey={ [ "kingdomino", "getState", data.id ] }
								startGame={ startGameFn }
							/>
						</div>
					) }
				</Fragment>
			) : (
				<div
					className={ cn(
						"grid grid-cols-2 gap-2 justify-between mb-52",
						data.status === "COMPLETED" && "grid-cols-1 md:grid-cols-2"
					) }
				>
					<PlayerScore
						player={ myPlayerInfo }
						showBoard={ data.status === "COMPLETED" }
						isWinner={ data.view.winner === myPlayerInfo.id }
					/>
					{ data.context.players.filter( pid => pid !== myPlayerInfo.id ).map( pid => (
						<PlayerScore
							key={ pid }
							player={ {
								...data.players[ pid ],
								...data.view.playerData[ pid ]
							} }
							showBoard={ data.status === "COMPLETED" }
							isWinner={ data.view.winner === pid }
						/>
					) ) }
					{ data.status === "IN_PROGRESS" && (
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
										boardSize={ data.config.boardSize }
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
							data.status === "COMPLETED" && "col-span-1 md:col-span-2"
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
					{ data.status !== "COMPLETED" && (
						<Fragment>
							<RDraft
								draft={ data.view.draft }
								players={ data.players }
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
