"use client";

import { RBoard } from "@/kingdomino/components/board";
import { useKingdomino } from "@/kingdomino/components/context";
import { RDraft } from "@/kingdomino/components/draft";
import { PlayerBoards } from "@/kingdomino/components/player-boards";
import { discardDomino, placeDomino, selectDomino } from "@/kingdomino/core/actions";
import type { Coord, DominoId, KingdominoPlayerInfo, Rotation } from "@/kingdomino/core/types";
import {
	canDominoBePlaced,
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

function PlayerScore( props: { player: KingdominoPlayerInfo } ) {
	return (
		<div className={ "flex flex-1 gap-2 items-center bg-background rounded-md" }>
			<RPlayerInfo player={ props.player }/>
			<div className={ "h-full rounded-r-md flex items-center justify-center flex-1" }>
				<h2 className={ cn( "text-2xl md:text-4xl font-heading text-center" ) }>
					{ props.player.score.points ?? 0 }
				</h2>
			</div>
		</div>
	);
}

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
											onCellClick={ canPlace ? handleCellClick : undefined }
											activeDominoId={ activeDomino }
											rotation={ rotation }
											getPreviewCoords={ canPlace ? getPreviewCoords : undefined }
										/>
									</div>
								</div>
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
