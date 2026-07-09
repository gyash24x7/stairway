"use client";

import type {
	Board,
	BoardSize,
	Castle,
	Coord,
	DominoId,
	Rotation,
	Tile
} from "@s2h/kingdomino-core/types";
import {
	canDominoBePlaced,
	coordKey,
	DOMINO_DECK,
	getCandidateCells,
	getExpandedBoardBounds,
	getPotentialCells,
	getRowsAndCols
} from "@s2h/kingdomino-core/utils";
import { Popover, PopoverContent } from "@/shared/primitives/popover";
import { cn } from "@s2h/shared/utils/cn";
import { motion } from "framer-motion";
import { CrownIcon } from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";

export function CrownIndicator( { count, size = 12 }: { count: number; size?: number } ) {
	if ( count <= 0 ) {
		return null;
	}
	return (
		<span className={ "inline-flex items-center gap-px" }>
			{ Array.from( { length: count } ).map( ( _, i ) => (
				<CrownIcon key={ i } size={ size } className={ "shrink-0" }/>
			) ) }
		</span>
	);
}

const ALL_ROTATIONS: Rotation[] = [ 0, 90, 180, 270 ];

const TERRAIN_CLASS: Record<string, string> = {
	desert: "bg-amber-200 text-amber-900",
	forest: "bg-emerald-200 text-emerald-900",
	water: "bg-sky-200 text-sky-900",
	grassland: "bg-lime-200 text-lime-900",
	wasteland: "bg-orange-200 text-orange-900",
	mine: "bg-slate-300 text-slate-900"
};

const CASTLE_CLASS: Record<Castle, string> = {
	red: "bg-red-200 text-red-900",
	blue: "bg-blue-200 text-blue-900",
	yellow: "bg-yellow-200 text-yellow-900",
	green: "bg-green-200 text-green-900"
};

type CellData = { label: string; crowns: number; className: string };

function getCellData( board: Board, x: number, y: number ) {
	const key = `${ x },${ y }`;
	const tile = board.tiles[ key ];
	if ( !tile ) {
		return null;
	}

	if ( tile.terrain === "castle" ) {
		return { label: "CASTLE", crowns: 0, className: CASTLE_CLASS[ board.castle ] };
	}

	return {
		label: tile.terrain.toUpperCase(),
		crowns: tile.crowns ?? 0,
		className: TERRAIN_CLASS[ tile.terrain ] ?? "bg-neutral-200 text-neutral-900"
	} as CellData;
}

export function RSmallBoard( { board }: { board: Board; } ) {
	const possibleCells = getCandidateCells( board );
	const { rows, cols } = getRowsAndCols( getExpandedBoardBounds( board ), possibleCells );

	const cells = rows.flatMap( y => cols.map( x => ( {
		cell: getCellData( board, x, y ),
		key: coordKey( { x, y } ),
		coord: { x, y }
	} ) ) );

	return (
		<div
			className={ "inline-grid gap-0.5 w-fit" }
			style={ { gridTemplateColumns: `repeat(${ cols.length }, minmax(0, 1fr))` } }
		>
			{ cells.map( ( { cell, key, coord } ) => !!cell
				? <SmallFilledCell cell={ cell } x={ coord.x } y={ coord.y } key={ key }/>
				: <SmallEmptyCell coord={ coord } key={ key }/>
			) }
		</div>
	);
}

function SmallFilledCell( { cell, x, y }: { cell: CellData; x: number; y: number; } ) {
	return (
		<motion.div
			layout
			initial={ { scale: 0.5, opacity: 0 } }
			animate={ { scale: 1, opacity: 1 } }
			transition={ { type: "spring", stiffness: 360, damping: 22 } }
			className={ cn(
				"w-6 h-6 rounded border border-inverted-surface overflow-hidden p-0.5",
				"font-semibold flex flex-wrap justify-between items-center",
				cell.className
			) }
			title={ `(${ x }, ${ y })` }
		>
			<CrownIndicator count={ cell.crowns } size={ 6 }/>
		</motion.div>
	);
}

function FilledCell( { cell, x, y }: { cell: CellData; x: number; y: number; } ) {
	return (
		<motion.div
			layout
			initial={ { scale: 0.4, opacity: 0 } }
			animate={ { scale: 1, opacity: 1 } }
			transition={ { type: "spring", stiffness: 380, damping: 22 } }
			className={ cn(
				"w-14 h-14 rounded border border-inverted-surface p-1 text-[10px] overflow-hidden",
				"font-semibold flex flex-col justify-between shrink-0",
				cell.className
			) }
			title={ `(${ x }, ${ y })` }
		>
			<span className={ "leading-tight" }>{ cell.label }</span>
			<span className={ "self-end" }>
				<CrownIndicator count={ cell.crowns } size={ 14 }/>
			</span>
		</motion.div>
	);
}

function PossibleCell( props: {
	coord: Coord;
	isClickable: boolean;
	isPreview: boolean;
	previewTile?: Tile;
	onClick?: ( coord: Coord ) => void;
	onHover?: ( coord: Coord | null ) => void;
} ) {
	const previewClass = props.previewTile
		? TERRAIN_CLASS[ props.previewTile.terrain ] ?? "bg-neutral-200 text-neutral-900"
		: null;

	return (
		<div
			className={ cn(
				"w-14 h-14 rounded border-2 border-dashed transition shrink-0",
				"flex items-center justify-center text-lg font-semibold",
				previewClass
					? cn( "opacity-60 border-green-400", previewClass )
					: props.isPreview
						? "border-green-400 bg-green-50/60 text-green-500"
						: props.isClickable
							? "border-blue-400 bg-blue-50/40 text-blue-500 cursor-pointer"
							: "border-yellow-400 bg-yellow-50/40 text-yellow-500"
			) }
			title={ `(${ props.coord.x }, ${ props.coord.y })` }
			onClick={ props.isClickable ? () => props.onClick?.( props.coord ) : undefined }
			onMouseEnter={ props.isClickable ? () => props.onHover?.( props.coord ) : undefined }
			onMouseLeave={ props.isClickable ? () => props.onHover?.( null ) : undefined }
		>
			{ props.previewTile
				? <CrownIndicator count={ props.previewTile.crowns } size={ 14 }/>
				: "+" }
		</div>
	);
}

function SmallEmptyCell( props: { coord: Coord; } ) {
	return (
		<div
			className={ cn( "w-6 h-6 rounded border border-dashed border-inverted-surface transition" ) }
			title={ `(${ props.coord.x }, ${ props.coord.y })` }
		/>
	);
}

function EmptyCell( props: { coord: Coord; isPlacement: boolean } ) {
	return (
		<div
			className={ cn(
				"w-14 h-14 rounded border border-dashed border-inverted-surface transition shrink-0",
				props.isPlacement && "border-blue-200"
			) }
			title={ `(${ props.coord.x }, ${ props.coord.y })` }
		/>
	);
}

function getCell( coord: Coord, board: Board, validCellKeys: Set<string> | null ) {
	const possibleCells = getPotentialCells( board );
	const key = coordKey( coord );
	return {
		cell: getCellData( board, coord.x, coord.y ),
		key,
		isPossible: possibleCells.some( c => c.x === coord.x && c.y === coord.y ),
		isValidPlacement: validCellKeys ? validCellKeys.has( key ) : false,
		coord
	};
}

export type Tentative = {
	coords: Coord[];
	anchor: Coord;
	toolbar: ReactNode;
	onClose: () => void;
};

type RBoardProps = {
	board: Board;
	boardSize: BoardSize;
	isActive?: boolean;
	activeDominoId?: DominoId | null;
	onCellClick?: ( coord: Coord ) => void;
	getPreviewCoords?: ( coord: Coord ) => Coord[] | null;
	tentative?: Tentative;
};

export function RBoard( props: RBoardProps ) {
	const bounds = getExpandedBoardBounds( props.board );
	const possibleCells = getPotentialCells( props.board );
	const [ hoveredCoord, setHoveredCoord ] = useState<Coord | null>( null );
	const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>( null );

	const showHoverPreview = !props.tentative;

	const previewCoords = showHoverPreview && hoveredCoord && props.getPreviewCoords
		? props.getPreviewCoords( hoveredCoord )
		: null;

	const previewKeys = new Set( previewCoords?.map( c => coordKey( c ) ) ?? [] );
	const tentativeKeys = new Set( props.tentative?.coords.map( c => coordKey( c ) ) ?? [] );

	const activeDomino = props.activeDominoId ? DOMINO_DECK[ props.activeDominoId - 1 ] : null;
	const previewTiles: Record<string, Tile> = {};
	if ( activeDomino ) {
		const pair = props.tentative?.coords ?? previewCoords;
		if ( pair && pair.length === 2 ) {
			previewTiles[ coordKey( pair[ 0 ] ) ] = activeDomino.left;
			previewTiles[ coordKey( pair[ 1 ] ) ] = activeDomino.right;
		}
	}

	// Cells valid at any rotation are clickable; rotation is chosen later in the popover
	const validCellKeys = props.isActive && props.activeDominoId
		? new Set( possibleCells
			.filter( coord => ALL_ROTATIONS.some( rotation => canDominoBePlaced(
				props.board,
				{ dominoId: props.activeDominoId!, coord, rotation }
			) ) )
			.map( c => coordKey( c ) ) )
		: null;

	const { rows, cols } = getRowsAndCols( bounds, possibleCells );

	const isPlacement = !!props.isActive;

	return (
		<div className={ "flex flex-col gap-1" }>
			{ rows.map( y => (
				<div className={ "flex gap-1" } key={ y }>
					{ cols.map( x => {
						const data = getCell( { x, y }, props.board, validCellKeys );
						const isAnchor = !!props.tentative
							&& props.tentative.anchor.x === x
							&& props.tentative.anchor.y === y;

						if ( data.cell ) {
							return <FilledCell cell={ data.cell } x={ x } y={ y } key={ data.key }/>;
						}

						if ( data.isPossible ) {
							const possibleCell = (
								<PossibleCell
									coord={ data.coord }
									isClickable={ isPlacement && data.isValidPlacement }
									isPreview={ previewKeys.has( data.key ) || tentativeKeys.has( data.key ) }
									previewTile={ previewTiles[ data.key ] }
									onClick={ props.onCellClick }
									onHover={ setHoveredCoord }
								/>
							);

							if ( isAnchor ) {
								return (
									<div ref={ setAnchorEl } key={ data.key }>
										{ possibleCell }
									</div>
								);
							}

							return <Fragment key={ data.key }>{ possibleCell }</Fragment>;
						}
						return <EmptyCell coord={ data.coord } isPlacement={ isPlacement } key={ data.key }/>;
					} ) }
				</div>
			) ) }
			{ props.tentative && anchorEl && (
				<Popover
					open
					onOpenChange={ open => {
						if ( !open ) {
							props.tentative!.onClose();
						}
					} }
				>
					<PopoverContent
						anchor={ anchorEl }
						side={ "bottom" }
						sideOffset={ 8 }
						className={ "w-auto bg-background border" }
					>
						{ props.tentative.toolbar }
					</PopoverContent>
				</Popover>
			) }
		</div>
	);
}
