import { cn } from "@base/components";
import { DisplayPlayer, type DisplayPlayerProps } from "@main/components";
import { useCardCounts, usePlayerCount, usePlayers } from "@literature/store";
import type { Literature } from "@stairway/types/literature";

export type PlayerLobbyProps = Omit<DisplayPlayerProps, "player" | "cardCount"> & { playerIds?: string[]; }

const sortByTeam = ( a: Literature.Player, b: Literature.Player ) => a.teamId?.localeCompare( b?.teamId ?? "" ) ?? 0;

export function PlayerLobby( props: PlayerLobbyProps ) {
	const players = usePlayers();
	const playerCount = usePlayerCount();
	const cardCounts = useCardCounts();

	const playerList = !props.playerIds
		? Object.values( players ).toSorted( sortByTeam )
		: Object.values( players ).filter( p => props.playerIds?.includes( p.id ) );

	return (
		<div
			className={ cn(
				"grid gap-2 py-2",
				playerCount === 6 && "grid-cols-3",
				playerCount === 6 && !props.playerIds && "lg:grid-cols-6",
				playerCount === 8 && "grid-cols-4",
				playerCount === 8 && !props.playerIds && "lg:grid-cols-8"
			) }
		>
			{ playerList.map( player => (
				<DisplayPlayer { ...props } player={ player } key={ player.id } cardCount={ cardCounts[ player.id ] }/>
			) ) }
		</div>
	);
}