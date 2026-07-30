import type { PlayerInfo } from "@/schema/swish";
import { cn } from "../utils/cn.ts";
import { RPlayerInfo } from "./player-info.tsx";

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
