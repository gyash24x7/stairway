"use client";

import { store } from "@/literature/store";
import { DisplayPlayer, type DisplayPlayerProps } from "@/shared/components/display-player";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";

export type PlayerLobbyProps = Omit<DisplayPlayerProps, "player" | "cardCount"> & { playerIds?: string[]; }

export function PlayerLobby( props: PlayerLobbyProps ) {
	const players = useStore( store, state => state.players );
	const playerCount = useStore( store, state => state.game.playerCount );

	const playerList = !props.playerIds
		? Object.values( players ).toSorted( ( a, b ) => a.teamId?.localeCompare( b?.teamId ?? "" ) ?? 0 )
		: Object.values( players ).filter( p => props.playerIds?.includes( p.id ) );

	return (
		<div
			className={ cn(
				"grid gap-2",
				playerCount === 2 && "grid-cols-1",
				playerCount === 2 && !props.playerIds && "lg:grid-cols-2",
				playerCount === 4 && "grid-cols-2",
				playerCount === 4 && !props.playerIds && "lg:grid-cols-4",
				playerCount === 6 && "grid-cols-3",
				playerCount === 6 && !props.playerIds && "lg:grid-cols-6",
				playerCount === 8 && "grid-cols-4",
				playerCount === 8 && !props.playerIds && "lg:grid-cols-8"
			) }
		>
			{ playerList.map( player => (
				<DisplayPlayer
					{ ...props }
					player={ player }
					key={ player.id }
					cardCount={ players[ player.id ].cardCount }
				/>
			) ) }
		</div>
	);
}