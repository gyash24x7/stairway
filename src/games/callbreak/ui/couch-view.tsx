import type { CallbreakConfig, CallbreakView } from "@/games/callbreak/schema";
import { CALLBREAK_TRICKS_PER_DEAL } from "@/games/callbreak/schema";
import { DealView } from "@/games/callbreak/ui/deal-view";
import { Scores } from "@/games/callbreak/ui/scores";
import { RCardSuit } from "@/shared/shell/card";
import type { GameView } from "@/swish/schema";
import { CouchLobby } from "@/swish/ui/couch-lobby";
import { CouchShell } from "@/swish/ui/couch-shell";
import { GameStandings } from "@/swish/ui/game-standings";
import { RematchNotice } from "@/swish/ui/rematch";
import { StatBlock } from "@/swish/ui/stat-block";
import { turnText } from "@/swish/ui/turn-banner";

type Game = GameView<CallbreakView, CallbreakConfig>;

/**
 * The shared screen. `DealView` and `Scores` read the public part of the view
 * only, so both are reused verbatim from the phone — there is no hand on this
 * screen to leak.
 */
export function CouchView( { game }: { game: Game } ) {
	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
	const isPlaying = game.status === "IN_PROGRESS";
	const isCompleted = game.status === "COMPLETED";

	const activeDeal = game.view.activeDeal;
	const completedTricks = activeDeal?.tricks.filter( t => !!t.winner ) ?? [];
	const turn = turnText( {
		status: game.status,
		players: game.players,
		currentPlayer: game.context.currentPlayer,
		action: game.context.phase === "declaring" ? "DECLARING" : undefined,
		seated: game.context.players.length,
		playerCount: game.config.playerCount,
		couch: true
	} );

	return (
		<CouchShell
			game={ "callbreak" }
			deadline={ game.runtime.deadline }
			turn={ turn }
			currentPlayer={ game.status === "IN_PROGRESS" ? game.context.currentPlayer : undefined }
			players={ game.players }
			notice={ <RematchNotice game={ "callbreak" } rematch={ game.runtime.rematch }/> }
			stretch={ !isLobby }
			headerInfo={
				<div className={ "flex gap-12" }>
					<StatBlock label={ "TRUMP" } large>
						<RCardSuit suit={ game.config.trumpSuit } large themed className={ "md:text-6xl" }/>
					</StatBlock>
					<StatBlock label={ "COMPLETED DEALS" } large>
						{ game.view.dealsPlayed }/{ game.config.dealCount }
					</StatBlock>
					<StatBlock label={ "COMPLETED TRICKS" } large>
						{ completedTricks.length }/{ CALLBREAK_TRICKS_PER_DEAL }
					</StatBlock>
				</div>
			}
			seats={ isPlaying
				? <Scores game={ game } large/>
				: isCompleted
					? <DealView game={ game } fill/>
					: null }
		>
			{ isLobby && (
				<CouchLobby
					players={ game.context.players.flatMap(
						id => game.players[ id ] ? [ game.players[ id ] ] : []
					) }
					seats={ game.config.playerCount }
				/>
			) }
			{ isPlaying && !!game.view.activeDeal && <DealView game={ game } fill/> }
			{ isCompleted && (
				<GameStandings
					results={ game.results }
					players={ game.players }
					scoreLabel={ "SCORE" }
					large
					className={ "h-full" }
				/>
			) }
		</CouchShell>
	);
}
