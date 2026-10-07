import * as HashSet from "effect/HashSet";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import type { CallbreakConfig, CallbreakView } from "@/games/callbreak/schema";
import { autoPlayAtom } from "@/games/callbreak/ui/client";
import { DeclareWins } from "@/games/callbreak/ui/declare-wins";
import { CallbreakHint } from "@/games/callbreak/ui/hint";
import { PlayCard } from "@/games/callbreak/ui/play-card";
import type { CardId } from "@/shared/utils/cards";
import type { GameView, PlayerId } from "@/swish/schema";
import { AutoPlayInput, GameId } from "@/swish/schema";
import { ActionBar } from "@/swish/ui/action-bar";
import { AutoPlayToggle } from "@/swish/ui/seat-controls";


type Game = GameView<CallbreakView, CallbreakConfig>;

export type ActionPanelProps = {
	readonly game: Game;
	readonly gameId: string;
	readonly me: PlayerId;
	readonly selectedCard?: CardId;
	readonly onPlayed: () => void;
};

/**
 * The sticky action bar on the full page. Every control it shows needs a seat, so
 * a screen with none (a spectator, or the account driving a television) gets
 * nothing.
 */
export function ActionPanel( { game, gameId, me, selectedCard, onPlayed }: ActionPanelProps ) {
	const autoPlay = useAtomSet( autoPlayAtom, { mode: "promiseExit" } );
	const switching = useAtomValue( autoPlayAtom ).waiting;
	const params = { gameId: GameId.make( gameId ) };

	const hasSeat = game.context.players.includes( me );
	if ( !hasSeat ) {
		return null;
	}

	const phase = game.context.phase;
	const isPlaying = game.status === "IN_PROGRESS";
	const isMyTurn = isPlaying && game.context.currentPlayer === me;
	const autoPlaying = HashSet.has( game.runtime.autoPlay, me );
	const dealId = game.view.activeDeal?.id;

	return (
		<ActionBar>
			{ isPlaying && (
				<AutoPlayToggle
					autoPlaying={ autoPlaying }
					setAutoPlay={ enabled => void autoPlay( {
						params,
						payload: AutoPlayInput.make( { enabled } )
					} ) }
					disabled={ switching }
				/>
			) }
			{ isPlaying && (
				<CallbreakHint gameId={ gameId } disabled={ !isMyTurn }/>
			) }
			{ isPlaying && !autoPlaying && phase === "declaring" && isMyTurn && (
				<DeclareWins gameId={ gameId } dealId={ dealId }/>
			) }
			{ isPlaying && !autoPlaying && phase === "playing" && isMyTurn && (
				<PlayCard
					gameId={ gameId }
					dealId={ dealId }
					selectedCard={ selectedCard }
					onPlayed={ onPlayed }
				/>
			) }
		</ActionBar>
	);
}
