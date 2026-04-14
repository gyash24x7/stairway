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
			<span className={ "leading-tight" }>{ props.terrain.toUpperCase() }</span>
			<span className={ "self-end text-xs" }>
					{ props.crowns > 0 ? `C${ props.crowns }` : "" }
				</span>
		</div>
	);
}

export function RSmallDomino( props: RDominoProps ) {
	return (
		<div
			className={ cn(
				"flex gap-0.5 rounded-md overflow-hidden bg-gray-400",
				"border-2 border-gray-400 transition",
				props.enabled && "cursor-pointer",
				!props.enabled ? "shadow-none" : "shadow-shadow",
				props.enabled && "hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
			) }
		>
			<RSmallTerrain terrain={ props.domino.left.terrain } crowns={ props.domino.left.crowns }/>
			<RSmallTerrain terrain={ props.domino.right.terrain } crowns={ props.domino.right.crowns }/>
		</div>
	);
}

export function RDomino( props: RDominoProps ) {

	const handleDominoClick = () => {
		if ( !props.enabled || !props.onClick ) {
			return;
		}

		props.onClick( props.domino.id );
	};

	return (
		<div
			className={ cn(
				"flex gap-0.5 rounded-md overflow-hidden bg-gray-400",
				"border-2 border-gray-400 transition",
				props.enabled && "cursor-pointer",
				!props.enabled ? "shadow-none" : props.isSelected ? "shadow-none" : "shadow-shadow",
				!props.isSelected &&
				props.enabled &&
				"hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
			) }
			onClick={ handleDominoClick }
		>
			<RTerrain terrain={ props.domino.left.terrain } crowns={ props.domino.left.crowns }/>
			<RTerrain terrain={ props.domino.right.terrain } crowns={ props.domino.right.crowns }/>
		</div>
	);
}