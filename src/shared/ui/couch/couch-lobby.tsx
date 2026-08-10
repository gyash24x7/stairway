"use client";

import type { PlayerInfo } from "@/shared/swish/schema.ts";
import { PlayerLobbyGrid } from "@/shared/ui/components/player-lobby.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

export type CouchLobbyProps = {
	/** The game's folder name — used to build the join url shown on screen. */
	game: string;
	code: string;
	players: PlayerInfo[];
	/** How many seats the game config asks for. */
	seats: number;
};

/**
 * The pre-game television screen: how to join, and who has so far.
 *
 * It never renders a start button. `start` is member-gated on the server and the
 * account driving the TV may hold no seat, so the copy sends everyone to a phone.
 */
export function CouchLobby( { players, seats }: CouchLobbyProps ) {
	const ready = players.length >= seats;

	return (
		<div className={ "w-full h-full flex flex-col gap-8 items-center" }>
			<PlayerLobbyGrid players={ players }/>
			<div className={ "flex items-center gap-4" }>
				{ !ready && <Spinner size={ "xl" }/> }
				<p className={ cn( "text-4xl font-heading" ) }>
					{ ready
						? "ALL PLAYERS JOINED"
						: `${ players.length } / ${ seats } SEATED` }
				</p>
			</div>
		</div>
	);
}
