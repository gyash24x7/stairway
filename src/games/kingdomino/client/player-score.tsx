import { motion } from "framer-motion";

import type { PlayerData } from "@/games/kingdomino/shared/schema.ts";
import type { PlayerInfo } from "@/shared/swish/schema.ts";
import { CounterTween } from "@/shared/ui/components/counter-tween.tsx";
import { FloatPlusN } from "@/shared/ui/components/float-plus-n.tsx";
import { RPlayerInfo } from "@/shared/ui/components/player-info.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { RSmallBoard } from "@/games/kingdomino/client/board.tsx";

type PlayerScoreProps = {
	player: PlayerData & PlayerInfo;
	showBoard?: boolean;
	isWinner?: boolean;
}

export function PlayerScore( props: PlayerScoreProps ) {
	const points = props.player.score.points ?? 0;
	return (
		<motion.div
			layout
			className={ cn(
				"flex flex-col gap-2 bg-background rounded-md",
				props.showBoard && "p-3",
				props.isWinner && "border-accent border-4"
			) }
			animate={ props.isWinner
				? {
					boxShadow: [
						"0 0 0 0 rgba(0,0,0,0)",
						"0 0 0 8px var(--color-accent)",
						"0 0 0 0 rgba(0,0,0,0)"
					]
				}
				: undefined
			}
			transition={ props.isWinner ? { duration: 1.6, repeat: 2 } : undefined }
		>
			<div className={ "flex flex-1 gap-2 items-center" }>
				<RPlayerInfo player={ props.player }/>
				<div className={ "h-full rounded-r-md flex items-center justify-center flex-1 relative" }>
					<h2 className={ cn( "text-2xl md:text-4xl font-heading text-center" ) }>
						<CounterTween value={ points }/>
					</h2>
					<FloatPlusN value={ points } className={ "text-base md:text-lg" }/>
				</div>
			</div>
			{ props.showBoard && (
				<div className={ "flex justify-center p-2" }>
					<RSmallBoard board={ props.player.board }/>
				</div>
			) }
		</motion.div>
	);
}
