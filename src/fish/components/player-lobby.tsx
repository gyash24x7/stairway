import { useFish } from "@/fish/components/context";
import { RPlayerInfo } from "@/shared/components/player-info";
import { cn } from "@/shared/utils/cn";

export function PlayerLobby() {
	const { shared } = useFish();

	return (
		<div
			className={ cn(
				"grid gap-2 w-full",
				shared.config.playerCount === 4 && "grid-cols-2 lg:grid-cols-4",
				shared.config.playerCount === 6 && "grid-cols-3 lg:grid-cols-6",
				shared.config.playerCount === 8 && "grid-cols-4 lg:grid-cols-8"
			) }
		>
			{ shared.context.players.map( playerId => (
				<RPlayerInfo player={ shared.players[ playerId ] } key={ playerId }/>
			) ) }
		</div>
	);
}