import type { Board, BoardSize, Castle, Coord, DominoId, Rotation } from "@/kingdomino/core/types";
import {
	canDominoBePlaced,
	coordKey,
	getCandidateCells,
	getExpandedBoardBounds,
	getPotentialCells,
	getRowsAndCols
} from "@/kingdomino/core/utils";
import { cn } from "@/shared/utils/cn";
import { useState } from "react";

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
		<div
			className={ cn(
				"w-6 h-6 rounded border border-inverted-surface p-1 overflow-hidden",
				"font-semibold flex flex-col justify-between transition",
				cell.className
			) }
			title={ `(${ x }, ${ y })` }
		>
			<span className={ "self-end text-[8px]" }>
				{ cell.crowns > 0 ? `C${ cell.crowns }` : "" }
			</span>
		</div>
	);
}

function FilledCell( { cell, x, y }: { cell: CellData; x: number; y: number; } ) {
	return (
		<div
			className={ cn(
				"w-14 h-14 rounded border border-inverted-surface p-1 text-[10px] overflow-hidden",
				"font-semibold flex flex-col justify-between transition",
				cell.className
			) }
			title={ `(${ x }, ${ y })` }
		>
			<span className={ "leading-tight" }>{ cell.label }</span>
			<span className={ "self-end text-xs" }>
				{ cell.crowns > 0 ? `C${ cell.crowns }` : "" }
			</span>
		</div>
	);
}

function PossibleCell( props: {
	coord: Coord;
	isClickable: boolean;
	isPreview: boolean;
	onClick?: ( coord: Coord ) => void;
	onHover?: ( coord: Coord | null ) => void;
} ) {
	return (
		<div
			className={ cn(
				"w-14 h-14 rounded border-2 border-dashed transition",
				"flex items-center justify-center text-lg",
				props.isPreview
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
			+
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
				"w-14 h-14 rounded border border-dashed border-inverted-surface transition",
				props.isPlacement && "border-blue-200"
			) }
			title={ `(${ props.coord.x }, ${ props.coord.y })` }
		/>
	);
}

type RBoardProps = {
	board: Board;
	boardSize: BoardSize;
	isActive?: boolean;
	activeDominoId?: DominoId | null;
	rotation?: Rotation;
	onCellClick?: ( coord: Coord ) => void;
	getPreviewCoords?: ( coord: Coord ) => Coord[] | null;
};

export function RBoard( props: RBoardProps ) {
	const bounds = getExpandedBoardBounds( props.board );
	const possibleCells = getPotentialCells( props.board );
	const [ hoveredCoord, setHoveredCoord ] = useState<Coord | null>( null );

	const previewCoords = hoveredCoord && props.getPreviewCoords
		? props.getPreviewCoords( hoveredCoord )
		: null;

	const previewKeys = new Set( previewCoords?.map( c => coordKey( c ) ) ?? [] );

	// Cells valid for current domino + rotation (clickable)
	const validCellKeys = props.isActive && props.activeDominoId
		? new Set( possibleCells
			.filter( coord => canDominoBePlaced(
				props.board,
				{ dominoId: props.activeDominoId!, coord, rotation: props.rotation! }
			) )
			.map( c => coordKey( c ) ) )
		: null;

	const { rows, cols } = getRowsAndCols( bounds, possibleCells );

	const cells = rows.flatMap( y => cols.map( x => {
		const key = coordKey( { x, y } );
		return {
			cell: getCellData( props.board, x, y ),
			key,
			isPossible: possibleCells.some( c => c.x === x && c.y === y ),
			isValidPlacement: validCellKeys ? validCellKeys.has( key ) : false,
			coord: { x, y }
		};
	} ) );

	const isPlacement = !!props.isActive;

	return (
		<div
			className={ "inline-grid gap-1 w-fit" }
			style={ { gridTemplateColumns: `repeat(${ cols.length }, minmax(0, 1fr))` } }
		>
			{ cells.map( ( { cell, key, isPossible, isValidPlacement, coord } ) => !!cell
				? <FilledCell cell={ cell } x={ coord.x } y={ coord.y } key={ key }/>
				: isPossible
					? <PossibleCell
						key={ key }
						coord={ coord }
						isClickable={ isPlacement && isValidPlacement }
						isPreview={ previewKeys.has( key ) }
						onClick={ props.onCellClick }
						onHover={ setHoveredCoord }
					/>
					: <EmptyCell coord={ coord } isPlacement={ isPlacement } key={ key }/>
			) }
		</div>
	);
}
