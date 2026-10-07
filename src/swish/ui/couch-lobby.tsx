import type { PlayerInfo } from "@/swish/schema";
import { PlayerLobbyGrid } from "@/swish/ui/player-lobby";


export type CouchLobbyProps = {
	/** The seats already taken, in seat order. */
	readonly players: ReadonlyArray<PlayerInfo>;
	/** Total seats at the table, so the empty ones can be drawn. */
	readonly seats: number;
};

/**
 * The shared screen's waiting room.
 *
 * It is the game code and the seats, at television size, and nothing else. A
 * couch screen takes no input, so there is no add-bots button and no start
 * button here — the footer's `turnText` already tells the room to use a phone,
 * and a control that cannot be pressed is worse than no control.
 */
export function CouchLobby( { players, seats }: CouchLobbyProps ) {
	const missing = Math.max( 0, seats - players.length );

	return (
		<div className={ "flex w-full flex-col items-center gap-8" }>
			<p className={ "font-heading text-4xl text-muted-foreground" }>
				{ missing > 0
					? `WAITING FOR ${ missing } MORE ${ missing === 1 ? "PLAYER" : "PLAYERS" }`
					: "EVERYONE IS HERE" }
			</p>

			<PlayerLobbyGrid players={ players } seats={ seats } large className={ "max-w-6xl" }/>
		</div>
	);
}
