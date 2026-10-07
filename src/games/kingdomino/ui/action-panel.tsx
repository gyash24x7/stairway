import * as HashSet from "effect/HashSet";

import type { KingdominoConfig, KingdominoView } from "@/games/kingdomino/schema";
import { KingdominoHint } from "@/games/kingdomino/ui/hint";
import { PlayerBoards } from "@/games/kingdomino/ui/player-boards";
import type { GameView, PlayerId } from "@/swish/schema";
import { ActionBar } from "@/swish/ui/action-bar";
import { AutoPlayToggle } from "@/swish/ui/seat-controls";

type Game = GameView<KingdominoView, KingdominoConfig>;

export type ActionPanelProps = {
	data: Game;
	gameId: string;
	playerId?: PlayerId;
	isPending: boolean;

	/** Whether the seat is the one the game is waiting on, either to draft or to lay. */
	acting: boolean;
	setAutoPlay: ( enabled: boolean ) => void;
};

/**
 * The sticky action bar on the full page. Every control it shows needs a seat, so
 * a screen with none (a spectator, or the account driving a television) gets
 * nothing.
 */
export function ActionPanel(
	{ data, gameId, playerId, isPending, acting, setAutoPlay }: ActionPanelProps
) {
	const isPlaying = data.status === "IN_PROGRESS";

	// Nothing to offer without a seat, and nothing once the game is over — and an
	// empty bar now reserves real space, since it measures itself.
	if ( !playerId || !isPlaying ) {
		return null;
	}

	const autoPlaying = HashSet.has( data.runtime.autoPlay, playerId );

	return (
		<ActionBar>
			<PlayerBoards data={ data } playerId={ playerId }/>
			<AutoPlayToggle
				autoPlaying={ autoPlaying }
				setAutoPlay={ setAutoPlay }
				disabled={ isPending }
			/>
			<KingdominoHint gameId={ gameId } disabled={ !acting }/>
		</ActionBar>
	);
}
