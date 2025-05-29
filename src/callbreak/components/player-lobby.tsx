"use client";

import { store } from "@/callbreak/store";
import { DisplayPlayer, type DisplayPlayerProps } from "@/shared/components/display-player";
import { useStore } from "@tanstack/react-store";

export type PlayerLobbyProps = Omit<DisplayPlayerProps, "player" | "cardCount" | "declaration"> & {
	playerIds?: string[];
	playerOrder?: string[];
}

export function PlayerLobby( props: PlayerLobbyProps ) {
	const deal = useStore( store, state => state.currentDeal );
	const playerList = useStore( store, state => props.playerOrder?.map( playerId => state.players[ playerId ] )
		?? Object.values( state.players ).toSorted( ( a, b ) => a.id.localeCompare( b.id ) ) );

	return (
		<div className={ "grid gap-3 grid-cols-2 lg:grid-cols-4" }>
			{ playerList.map( player => (
				<DisplayPlayer
					{ ...props }
					player={ player }
					key={ player.id }
					declaration={ deal?.scores[ player.id ].declarations }
				/>
			) ) }
		</div>
	);
}