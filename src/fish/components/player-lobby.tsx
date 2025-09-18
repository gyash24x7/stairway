"use client";

import { store } from "@/fish/components/store";
import { DisplayPlayer, type DisplayPlayerProps } from "@/shared/components/display-player";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";

export type PlayerLobbyProps = Omit<DisplayPlayerProps, "player" | "cardCount"> & { playerIds?: string[]; }

export function PlayerLobby( props: PlayerLobbyProps ) {
	const players = useStore( store, state => state.players );
	const playerIds = useStore( store, state => state.playerIds );
	const cardCounts = useStore( store, state => state.cardCounts );
	const playerCount = useStore( store, state => state.config.playerCount );

	return (
		<div
			className={ cn(
				"grid gap-2",
				playerCount === 3 && "grid-cols-1",
				playerCount === 3 && !props.playerIds && "lg:grid-cols-3",
				playerCount === 4 && "grid-cols-2",
				playerCount === 4 && !props.playerIds && "lg:grid-cols-4",
				playerCount === 6 && "grid-cols-3",
				playerCount === 6 && !props.playerIds && "lg:grid-cols-6",
				playerCount === 8 && "grid-cols-4",
				playerCount === 8 && !props.playerIds && "lg:grid-cols-8"
			) }
		>
			{ playerIds.map( playerId => (
				<DisplayPlayer
					{ ...props }
					player={ players[ playerId ] }
					key={ playerId }
					cardCount={ cardCounts[ playerId ] }
				/>
			) ) }
		</div>
	);
}