import { useFish } from "@/fish/components/context";
import { RPlayerInfo } from "@/shared/components/player-info";
import { cn } from "@/shared/utils/cn";

export function PlayerLobby() {
	const { game } = useFish();

	return (
		<div
			className={ cn(
				"grid gap-2 w-full",
				game.config.playerCount === 4 && "grid-cols-2 lg:grid-cols-4",
				game.config.playerCount === 6 && "grid-cols-3 lg:grid-cols-6",
				game.config.playerCount === 8 && "grid-cols-4 lg:grid-cols-8"
			) }
		>
			{ game.context.players.map( playerId => (
				<RPlayerInfo player={ game.players[ playerId ] } key={ playerId }/>
			) ) }
		</div>
	);
}