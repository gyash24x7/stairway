import { CrownIndicator } from "@/kingdomino/components/board";
import type { Domino, DominoId, Terrain } from "@/kingdomino/core/types";
import { cn } from "@s2h/shared/utils/cn";
import { motion } from "framer-motion";

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
			<span className={ "self-center" }>
				<CrownIndicator count={ props.crowns } size={ 12 }/>
			</span>
		</div>
	);
}

function RTerrain( props: { terrain: Terrain; crowns: number } ) {
	return (
		<div
			className={ cn(
				"w-10 md:w-14 h-10 md:h-14 p-1 text-[8px] md:text-xs",
				"font-semibold flex flex-col justify-between",
				TERRAIN_CLASS[ props.terrain ]
			) }
		>
			<span className={ "leading-tight" }>
				{ props.terrain.toUpperCase() }
			</span>
			<span className={ "self-end" }>
				<CrownIndicator count={ props.crowns } size={ 14 }/>
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
				!enabled ? "shadow-none" : "shadow-sm md:shadow-md",
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
		<motion.div
			whileHover={ enabled ? { scale: 1.04 } : undefined }
			whileTap={ enabled ? { scale: 0.96 } : undefined }
			animate={ isSelected ? { scale: [ 1, 1.05, 1 ] } : { scale: 1 } }
			transition={ isSelected
				? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
				: { type: "spring", stiffness: 400, damping: 22 }
			}
			className={ cn(
				"flex gap-0.5 rounded-md overflow-hidden bg-gray-400",
				"border-2 border-inverted-surface",
				enabled && "cursor-pointer",
				!enabled ? "shadow-none" : isSelected ? "shadow-none" : "shadow-sm md:shadow-md"
			) }
			onClick={ handleDominoClick }
		>
			<RTerrain terrain={ domino.left.terrain } crowns={ domino.left.crowns }/>
			<RTerrain terrain={ domino.right.terrain } crowns={ domino.right.crowns }/>
		</motion.div>
	);
}