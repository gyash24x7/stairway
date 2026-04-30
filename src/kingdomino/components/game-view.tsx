"use client";

import { RBoard } from "@/kingdomino/components/board";
import { useKingdomino } from "@/kingdomino/components/context";
import { RDomino } from "@/kingdomino/components/domino";
import { RDraft } from "@/kingdomino/components/draft";
import { ROpponent } from "@/kingdomino/components/opponent";
import { discardDomino, placeDomino, selectDomino } from "@/kingdomino/core/actions";
import type { Coord, DominoId, Rotation } from "@/kingdomino/core/types";
import {
	canDominoBePlaced,
	DOMINO_DECK,
	getPlacementCoordinates,
	getValidPlacements
} from "@/kingdomino/core/utils";
import { GameInfo } from "@/shared/components/game-info";
import { RPlayerInfo } from "@/shared/components/player-info";
import { PlayerLobbyGrid } from "@/shared/components/player-lobby";
import { Button } from "@/shared/primitives/button";
import { cn } from "@/shared/utils/cn";
import { RotateCcwIcon, RotateCwIcon } from "lucide-react";
import { Fragment, useCallback, useState, useTransition } from "react";

export function GameView() {
	const { shared, player } = useKingdomino();

	const isMyTurn = shared.status === "IN_PROGRESS" &&
		shared.context.currentPlayer === player.playerId;

	const isLobby = shared.status === "CREATED" || shared.status === "PLAYERS_READY";

	const myPlayerInfo = {
		...shared.players[ player.playerId ],
		...shared.state.playerData[ player.playerId ]
	};

	const [ isPending, startTransition ] = useTransition();

	const [ selectedDominoId, setSelectedDominoId ] = useState<DominoId | null>( null );
	const [ rotation, setRotation ] = useState<Rotation>( 0 );

	const canSelect = isMyTurn && shared.context.phase === "SELECT" && !isPending;
	const canPlace = isMyTurn && shared.context.phase === "PLACE" && !isPending;
	const activeDomino = selectedDominoId ??
		( canPlace ? myPlayerInfo.queue.toSorted( ( a, b ) => a - b )[ 0 ] : null );

	const handleDominoSelect = ( dominoId: number ) => {
		if ( !canSelect ) {
			return;
		}

		return startTransition( async () => {
			await selectDomino( { gameId: shared.id, dominoId } );
		} );
	};

	const handleQueueDominoClick = ( dominoId: DominoId ) => {
		setSelectedDominoId( dominoId );
		setRotation( 0 );
	};

	const handleRotateCw = useCallback( () => {
		setRotation( prev => ( ( prev + 90 ) % 360 ) as Rotation );
	}, [] );

	const handleRotateCcw = useCallback( () => {
		setRotation( prev => ( ( prev + 270 ) % 360 ) as Rotation );
	}, [] );

	const handleCellClick = ( coord: Coord ) => {
		if ( !canPlace || !activeDomino ) {
			return;
		}

		const placement = { dominoId: activeDomino, coord, rotation };
		if ( !canDominoBePlaced( myPlayerInfo.board, placement ) ) {
			return;
		}

		return startTransition( async () => {
			await placeDomino( { gameId: shared.id, placement } );
			setSelectedDominoId( null );
			setRotation( 0 );
		} );
	};

	const canDiscard = canPlace && activeDomino
		? getValidPlacements( myPlayerInfo.board, activeDomino ).length === 0
		: false;

	const handleDiscard = () => {
		if ( !canDiscard || !activeDomino ) {
			return;
		}

		return startTransition( async () => {
			await discardDomino( { gameId: shared.id, dominoId: activeDomino } );
			setSelectedDominoId( null );
			setRotation( 0 );
		} );
	};

	// Compute preview cells for the active domino at hover
	const getPreviewCoords = ( coord: Coord ): Coord[] | null => {
		if ( !activeDomino ) {
			return null;
		}
		const placement = { dominoId: activeDomino, coord, rotation };
		if ( !canDominoBePlaced( myPlayerInfo.board, placement ) ) {
			return null;
		}
		return getPlacementCoordinates( { coord, rotation } );
	};

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
		<div className={ `flex flex-col gap-3 w-full max-w-6xl` }>
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
			{ isLobby && (
				<Fragment>
					<PlayerLobbyGrid
						players={ shared.context.players.map( id => shared.players[ id ] ) }
					/>
					<div className={ "p-2 w-full rounded-md bg-accent text-center" }>
						<span className={ "text-2xl font-heading" }>{ getStatusMsg() }</span>
					</div>
				</Fragment>
			) }
			{ !isLobby && (
				<div className={ "grid grid-cols-8 gap-2 justify-between mb-52" }>
					<div className={ "col-span-3 flex flex-1 flex-col gap-2" }>
						<div className={ "flex gap-2" }>
							<RPlayerInfo player={ shared.players[ player.playerId ] }/>
							<div className={ "p-4 bg-background rounded-md" }>
								<p className={ "text-xs md:text-sm" }>POINTS</p>
								<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>
									{ myPlayerInfo.score.points ?? 0 }
								</h2>
							</div>
						</div>
						{ shared.state.draft.length > 0 && (
							<RDraft
								draft={ shared.state.draft }
								active={ canSelect }
								players={ shared.players }
								onSelect={ handleDominoSelect }
							/>
						) }
						{ shared.context.players.filter( pid => pid !== myPlayerInfo.id )
							.map( pid => <ROpponent playerId={ pid } key={ pid }/> ) }
					</div>
					<div className={ "col-span-5 flex-1 flex flex-col gap-2" }>
						{ shared.status === "IN_PROGRESS" && (
							<div className={ "p-2 bg-background rounded-md flex flex-col gap-2 items-center" }>
								<RBoard
									board={ myPlayerInfo.board }
									boardSize={ shared.config.boardSize }
									isActive={ canPlace }
									onCellClick={ canPlace ? handleCellClick : undefined }
									activeDominoId={ activeDomino }
									rotation={ rotation }
									getPreviewCoords={ canPlace ? getPreviewCoords : undefined }
								/>
								{ canPlace && (
									<div className={ "flex gap-2" }>
										<Button size={ "icon" } onClick={ handleRotateCcw }>
											<RotateCcwIcon/>
										</Button>
										<Button size={ "icon" } onClick={ handleRotateCw }>
											<RotateCwIcon/>
										</Button>
										{ canDiscard && (
											<Button onClick={ handleDiscard } disabled={ isPending }>
												Discard
											</Button>
										) }
									</div>
								) }
							</div>
						) }
						<div className={ "p-2 w-full rounded-md bg-accent text-center" }>
							<span className={ "text-2xl font-heading" }>{ getStatusMsg() }</span>
						</div>
						{ canPlace && myPlayerInfo.queue.length > 0 && (
							<div
								className={ cn(
									"p-2 bg-background rounded-md w-full",
									"flex gap-2 justify-around items-center"
								) }
							>
								{ myPlayerInfo.queue.toSorted( ( a, b ) => a - b ).map( ( dominoId ) => (
									<RDomino
										key={ dominoId }
										domino={ DOMINO_DECK[ dominoId - 1 ] }
										enabled={ true }
										isSelected={ activeDomino === dominoId }
										onClick={ handleQueueDominoClick }
									/>
								) ) }
							</div>
						) }
					</div>
				</div>
			) }
		</div>
	);
}
