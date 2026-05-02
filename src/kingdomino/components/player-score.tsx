import { RSmallBoard } from "@/kingdomino/components/board";
import type { KingdominoPlayerInfo } from "@/kingdomino/core/types";
import { RPlayerInfo } from "@/shared/components/player-info";
import { cn } from "@/shared/utils/cn";

type PlayerScoreProps = {
	player: KingdominoPlayerInfo;
	showBoard?: boolean;
	isWinner?: boolean;
}

export function PlayerScore( props: PlayerScoreProps ) {
	return (
		<div
			className={ cn(
				"flex flex-col gap-2 bg-background rounded-md",
				props.showBoard && "p-3",
				props.isWinner && "border-accent border-4"
			) }
		>
			<div className={ "flex flex-1 gap-2 items-center" }>
				<RPlayerInfo player={ props.player }/>
				<div className={ "h-full rounded-r-md flex items-center justify-center flex-1" }>
					<h2 className={ cn( "text-2xl md:text-4xl font-heading text-center" ) }>
						{ props.player.score.points ?? 0 }
					</h2>
				</div>
			</div>
			{ props.showBoard && (
				<div className={ "flex justify-center p-2" }>
					<RSmallBoard board={ props.player.board }/>
				</div>
			) }
		</div>
	);
}
