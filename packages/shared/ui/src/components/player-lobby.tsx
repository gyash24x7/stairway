import type { BasePlayerInfo } from "@s2h/engine/types";
import { cn } from "@s2h/ui/utils/cn";
import { RPlayerInfo } from "./player-info";

export type PlayerLobbyGridProps = {
	players: BasePlayerInfo[];
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
