"use client";

import { DisplayPlayer, type DisplayPlayerProps } from "@/shared/components/display-player";
import { store } from "@/literature/store";
import type { Literature } from "@/literature/types";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";

export type PlayerLobbyProps = Omit<DisplayPlayerProps, "player" | "cardCount"> & { playerIds?: string[]; }

const sortByTeam = ( a: Literature.Player, b: Literature.Player ) => a.teamId?.localeCompare( b?.teamId ?? "" ) ?? 0;

export function PlayerLobby( props: PlayerLobbyProps ) {
	const players = useStore( store, state => state.players );
	const playerCount = useStore( store, state => state.game.playerCount );
	const cardCounts = useStore( store, state => state.cardCounts );

	const playerList = !props.playerIds
		? Object.values( players ).toSorted( sortByTeam )
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
				<DisplayPlayer { ...props } player={ player } key={ player.id } cardCount={ cardCounts[ player.id ] }/>
			) ) }
		</div>
	);
}