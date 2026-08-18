import { cn } from "@/shared/ui/utils/cn.ts";
import { RPlayerInfo } from "@/swish/client/player-info.tsx";

import type { PlayerInfo } from "@/swish/shared/schema.ts";

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
