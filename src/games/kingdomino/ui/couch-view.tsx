import type { KingdominoConfig, KingdominoView } from "@/games/kingdomino/schema";
import { RDraft } from "@/games/kingdomino/ui/draft";
import { kingdomBoardSize, KingdomTile } from "@/games/kingdomino/ui/kingdom-tile";
import { PickingOrder } from "@/games/kingdomino/ui/picking-order";
import type { GameView } from "@/swish/schema";
import { CouchLobby } from "@/swish/ui/couch-lobby";
import { CouchShell } from "@/swish/ui/couch-shell";
import { GameStandings } from "@/swish/ui/game-standings";
import { RematchNotice } from "@/swish/ui/rematch";
import { StatBlock } from "@/swish/ui/stat-block";
import { turnText } from "@/swish/ui/turn-banner";

type Game = GameView<KingdominoView, KingdominoConfig>;

export type CouchViewProps = {
	readonly game: Game;
};

/**
 * The shared screen. Kingdomino hides nothing but the undrawn deck, so the
 * television can show the whole table: every kingdom on the centre stage, and the
 * round's draft — including who has taken what — down the rail.
 */
export function CouchView( { game }: CouchViewProps ) {
	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
	const isPlaying = game.status === "IN_PROGRESS";
	const isCompleted = game.status === "COMPLETED";

	const players = game.context.players;
	const boardSize = kingdomBoardSize( players.length, game.config.boardSize );

	const turn = turnText( {
		status: game.status,
		players: game.players,
		currentPlayer: game.context.currentPlayer,
		action: game.context.phase === "SELECT" ? "PICKING A DOMINO" : "PLACING",
		seated: players.length,
		playerCount: game.config.playerCount,
		couch: true
	} );

	return (
		<CouchShell
			game={ "kingdomino" }
			deadline={ game.runtime.deadline }
			turn={ turn }
			currentPlayer={ game.status === "IN_PROGRESS" ? game.context.currentPlayer : undefined }
			players={ game.players }
			notice={ <RematchNotice game={ "kingdomino" } rematch={ game.runtime.rematch }/> }
			stretch={ !isLobby }
			headerInfo={
				<div className={ "flex gap-12" }>
					<StatBlock label={ "BOARD" } large>
						{ game.config.boardSize }x{ game.config.boardSize }
					</StatBlock>
					<StatBlock label={ "PLAYERS" } large>{ game.config.playerCount }</StatBlock>
				</div>
			}
			seats={
				isPlaying ? (
					<>
						<PickingOrder data={ game } large/>
						<p className={ "text-metric-label-lg shrink-0" }>DRAFT</p>
						<RDraft draft={ game.view.draft } players={ game.players } large/>
					</>
				) : isCompleted ? (
					players.map( pid => (
						<KingdomTile
							key={ pid }
							data={ game }
							playerId={ pid }
							showQueue={ false }
							showBoard={ false }
						/>
					) )
				) : null
			}
		>
			{ isLobby && (
				<CouchLobby
					players={ players.map( id => game.players[ id ] ).filter( p => !!p ) }
					seats={ game.config.playerCount }
				/>
			) }
			{ isPlaying && (
				<div className={ "h-full min-h-0 w-full grid grid-cols-2 gap-4 auto-rows-fr" }>
					{ players.map( pid => (
						<KingdomTile key={ pid } data={ game } playerId={ pid } size={ boardSize }/>
					) ) }
				</div>
			) }
			{ isCompleted && (
				// Sized to its rows and centred, not stretched: a two-seat table has two
				// of them, and filling the stage would give each a row taller than a
				// kingdom.
				<div className={ "w-full max-h-full overflow-hidden flex items-center" }>
					<GameStandings
						results={ game.results }
						players={ game.players }
						scoreLabel={ "POINTS" }
						large
					/>
				</div>
			) }
		</CouchShell>
	);
}
