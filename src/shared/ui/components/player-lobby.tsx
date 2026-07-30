import type { PlayerInfo } from "@/shared/swish/schema.ts";
import { cn } from "@/shared/ui/utils/cn.ts";
import { RPlayerInfo } from "@/shared/ui/components/player-info.tsx";

export type PlayerLobbyGridProps = {
	players: PlayerInfo[];
	className?: string;
};

export function PlayerLobbyGrid( props: PlayerLobbyGridProps ) {
	return (
		<div
			className={ cn(
				"flex flex-wrap gap-2 justify-center w-full",
				props.className
			) }
		>
			{ props.players.map( p => (
				<div className={ "flex-1 min-w-30" } key={ p.id }>
					<RPlayerInfo player={ p }/>
				</div>
			) ) }
		</div>
	);
}
