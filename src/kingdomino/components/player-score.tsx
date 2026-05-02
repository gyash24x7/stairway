import type { KingdominoPlayerInfo } from "@/kingdomino/core/types";
import { RPlayerInfo } from "@/shared/components/player-info";
import { cn } from "@/shared/utils/cn";

export function PlayerScore( props: { player: KingdominoPlayerInfo } ) {
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
