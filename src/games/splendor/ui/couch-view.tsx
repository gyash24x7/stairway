import type { SplendorConfig, SplendorView } from "@/games/splendor/schema";
import { Board } from "@/games/splendor/ui/board";
import { PlayerInfo } from "@/games/splendor/ui/player-info";
import { PlayerTableau } from "@/games/splendor/ui/player-tableau";
import { TokenBar } from "@/games/splendor/ui/token-bar";
import type { GameView } from "@/swish/schema";
import { CouchLobby } from "@/swish/ui/couch-lobby";
import { CouchShell } from "@/swish/ui/couch-shell";
import { GameStandings } from "@/swish/ui/game-standings";
import { RematchNotice } from "@/swish/ui/rematch";
import { StatBlock } from "@/swish/ui/stat-block";
import { turnText } from "@/swish/ui/turn-banner";


type Game = GameView<SplendorView, SplendorConfig>;

export type CouchViewProps = {
	readonly game: Game;
};

/**
 * The shared screen. Renders the same `Board`/`PlayerInfo` components the phone
 * uses — no `renderCard`, no `reservedSlot`, so every one of them is read-only —
 * scaled up by `CouchShell`'s design canvas.
 */
export function CouchView( { game }: CouchViewProps ) {
	// A seat is only renderable with both halves of it — its roster entry and its
	// tableau. Resolved once here so the places that list seats cannot disagree
	// about which ones exist, and none of them has to assert that they do.
	const seats = game.context.players.flatMap( id => {
		const player = game.players[ id ];
		const playerData = game.view.playerData[ id ];
		return player && playerData ? [ { id, player, playerData } ] : [];
	} );

	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
	const isPlaying = game.status === "IN_PROGRESS";

	const isLastRound = isPlaying && Object.values( game.view.playerData )
		.some( p => p.points >= game.config.winningPoints );

	const turn = turnText( {
		status: game.status,
		players: game.players,
		currentPlayer: game.context.currentPlayer,
		note: isLastRound ? "LAST ROUND!" : undefined,
		seated: game.context.players.length,
		playerCount: game.config.playerCount,
		couch: true
	} );

	return (
		<CouchShell
			game={ "splendor" }
			deadline={ game.runtime.deadline }
			turn={ turn }
			currentPlayer={ game.status === "IN_PROGRESS" ? game.context.currentPlayer : undefined }
			players={ game.players }
			notice={ <RematchNotice game={ "splendor" } rematch={ game.runtime.rematch }/> }
			stretch={ !isLobby }
			headerInfo={
				<StatBlock label={ "WINNING POINTS" } large>{ game.config.winningPoints }</StatBlock>
			}
			seats={
				isLobby ? null : game.status === "COMPLETED"
					? (
						<GameStandings
							results={ game.results }
							players={ game.players }
							scoreLabel={ "POINTS" }
						/>
					)
					: (
						<>
							<TokenBar
								tokens={ game.view.tokens }
								tokenText={ "TOKENS" }
								onTokenClick={ () => undefined }
								large
							/>
							{ seats.map( ( { id, player, playerData } ) => (
								<PlayerInfo
									key={ id }
									player={ player }
									playerData={ playerData }
									isCurrentTurn={ game.context.currentPlayer === id }
									large
								/>
							) ) }
						</>
					)
			}
		>
			{ isLobby && (
				<CouchLobby
					players={ game.context.players.flatMap( id => game.players[ id ]
						? [ game.players[ id ] ]
						: [] ) }
					seats={ game.config.playerCount }
				/>
			) }
			{ isPlaying && (
				<Board
					cards={ game.view.cards }
					nobles={ game.view.nobles }
					playerCount={ game.config.playerCount }
					fill
				/>
			) }
			{ game.status === "COMPLETED" && (
				<div className={ "h-full min-h-0 w-full grid grid-cols-2 gap-4 auto-rows-fr" }>
					{ seats.map( ( { id, player, playerData } ) => (
						<PlayerTableau
							key={ id }
							player={ player }
							cards={ playerData.cards }
							nobles={ playerData.nobles }
							large
						/>
					) ) }
				</div>
			) }
		</CouchShell>
	);
}
