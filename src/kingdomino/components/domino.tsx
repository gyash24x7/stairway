import type { Domino, DominoId, Terrain } from "@/kingdomino/core/types";
import { cn } from "@/shared/utils/cn";

const TERRAIN_CLASS: Record<string, string> = {
	desert: "bg-amber-200 text-amber-900",
	forest: "bg-emerald-200 text-emerald-900",
	water: "bg-sky-200 text-sky-900",
	grassland: "bg-lime-200 text-lime-900",
	wasteland: "bg-orange-200 text-orange-900",
	mine: "bg-slate-300 text-slate-900"
};


type RDominoProps = {
	domino: Domino;
	isSelected?: boolean;
	enabled?: boolean;
	onClick?: ( dominoId: DominoId ) => void;
}

function RSmallTerrain( props: { terrain: Terrain; crowns: number } ) {
	return (
		<div
			className={ cn(
				"min-w-6 min-h-6 p-0.5 flex flex-col justify-between items-center",
				TERRAIN_CLASS[ props.terrain ]
			) }
		>
			<p className={ "self-center text-sm font-semibold" }>
				{ props.crowns > 0 ? `C${ props.crowns }` : "" }
			</p>
		</div>
	);
}

function RTerrain( props: { terrain: Terrain; crowns: number } ) {
	return (
		<div
			className={ cn(
				"w-14 h-14 p-1 text-[10px] font-semibold flex flex-col justify-between",
				TERRAIN_CLASS[ props.terrain ]
			) }
		>
			<span className={ "leading-tight" }>
				{ props.terrain.toUpperCase() }
			</span>
			<span className={ "self-end text-xs" }>
				{ props.crowns > 0 ? `C${ props.crowns }` : "" }
			</span>
		</div>
	);
}

export function RSmallDomino( { enabled, domino }: RDominoProps ) {
	return (
		<div
			className={ cn(
				"flex gap-0.5 rounded-md overflow-hidden bg-gray-400",
				"border-2 border-inverted-surface transition",
				!enabled ? "shadow-none" : "shadow-shadow",
				enabled && "cursor-pointer hover:shadow-none",
				enabled && "hover:translate-x-boxShadowX hover:translate-y-boxShadowY"
			) }
		>
			<RSmallTerrain terrain={ domino.left.terrain } crowns={ domino.left.crowns }/>
			<RSmallTerrain terrain={ domino.right.terrain } crowns={ domino.right.crowns }/>
		</div>
	);
}

export function RDomino( { domino, enabled, isSelected, onClick }: RDominoProps ) {

	const handleDominoClick = () => {
		if ( !enabled || !onClick ) {
			return;
		}

		onClick( domino.id );
	};

	return (
		<div
			className={ cn(
				"flex gap-0.5 rounded-md overflow-hidden bg-gray-400",
				"border-2 border-inverted-surface transition",
				enabled && "cursor-pointer",
				!enabled ? "shadow-none" : isSelected ? "shadow-none" : "shadow-shadow",
				!isSelected && enabled && (
					"hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
				)
			) }
			onClick={ handleDominoClick }
		>
			<RTerrain terrain={ domino.left.terrain } crowns={ domino.left.crowns }/>
			<RTerrain terrain={ domino.right.terrain } crowns={ domino.right.crowns }/>
		</div>
	);
}