import { DisplayPlayer, type DisplayPlayerProps } from "@main/components";
import { useCurrentDeal, usePlayerList } from "@callbreak/store";

export type PlayerLobbyProps = Omit<DisplayPlayerProps, "player" | "cardCount" | "declaration"> & {
	playerIds?: string[];
}

export function PlayerLobby( props: PlayerLobbyProps ) {
	const playerList = usePlayerList();
	const deal = useCurrentDeal();

	return (
		<div className={ "grid gap-3 grid-cols-2 lg:grid-cols-4" }>
			{ playerList.map( player => (
				<DisplayPlayer
					{ ...props }
					player={ player }
					key={ player.id }
					declaration={ deal?.declarations[ player.id ] }
				/>
			) ) }
		</div>
	);
}