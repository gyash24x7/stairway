import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { cn } from "cn";
import { Fragment } from "react";

import type { KingdominoConfig, KingdominoView } from "@/games/kingdomino/schema";
import { ActionPanel } from "@/games/kingdomino/ui/action-panel";
import { RBoard } from "@/games/kingdomino/ui/board";
import {
	addBotsAtom,
	autoPlayAtom,
	discardDominoAtom,
	placeDominoAtom,
	rematchAtom,
	selectDominoAtom,
	startGameAtom
} from "@/games/kingdomino/ui/client";
import { RDomino } from "@/games/kingdomino/ui/domino";
import { RDraft } from "@/games/kingdomino/ui/draft";
import { PickingOrder } from "@/games/kingdomino/ui/picking-order";
import { PlayerScore } from "@/games/kingdomino/ui/player-score";
import { useKingdominoTurn } from "@/games/kingdomino/ui/use-turn";
import { getDomino } from "@/games/kingdomino/utils";
import { Button } from "@/shared/primitives/button";
import type { GameView, PlayerId } from "@/swish/schema";
import { AutoPlayInput, GameId } from "@/swish/schema";
import { GameInfo } from "@/swish/ui/game-info";
import { GameStandings } from "@/swish/ui/game-standings";
import { GameStatusPanel } from "@/swish/ui/game-status-panel";
import { PlayerLobbyGrid } from "@/swish/ui/player-lobby";
import { RematchPanel } from "@/swish/ui/rematch";
import { AddBots, StartGame } from "@/swish/ui/seat-controls";
import { StatBlock } from "@/swish/ui/stat-block";
import { TurnBanner } from "@/swish/ui/turn-banner";


type Game = GameView<KingdominoView, KingdominoConfig>;

export type KingdominoGameViewProps = {
	readonly game: Game;
	readonly gameId: string;
};

export function KingdominoGameView( { game, gameId }: KingdominoGameViewProps ) {
	const params = { gameId: GameId.make( gameId ) };

	const addBots = useAtomSet( addBotsAtom, { mode: "promiseExit" } );
	const start = useAtomSet( startGameAtom, { mode: "promiseExit" } );
	const setAutoPlay = useAtomSet( autoPlayAtom, { mode: "promiseExit" } );
	const selectDomino = useAtomSet( selectDominoAtom, { mode: "promiseExit" } );
	const placeDomino = useAtomSet( placeDominoAtom, { mode: "promiseExit" } );
	const discardDomino = useAtomSet( discardDominoAtom, { mode: "promiseExit" } );

	const adding = useAtomValue( addBotsAtom ).waiting;
	const starting = useAtomValue( startGameAtom ).waiting;
	const switching = useAtomValue( autoPlayAtom ).waiting;
	const isSelectPending = useAtomValue( selectDominoAtom ).waiting;
	const isDiscardPending = useAtomValue( discardDominoAtom ).waiting;
	const isPlacePending = useAtomValue( placeDominoAtom ).waiting || isDiscardPending;

	const isPending = adding || starting || switching || isSelectPending || isPlacePending;

	const playerId = game.view.playerId;

	const {
		seated,
		board,
		isMyTurn,
		canSelect,
		canPlace,
		activeDomino,
		handleDominoSelect,
		placement
	} = useKingdominoTurn( {
		data: game,
		playerId,
		selectDomino: input => selectDomino( { params, payload: input } ),
		placeDomino: input => placeDomino( { params, payload: input } ),
		discardDomino: input => discardDomino( { params, payload: input } ),
		isSelectPending,
		isPlacePending
	} );

	// `getDomino` is a lookup into the fixed deck, so it can miss on an id the
	// client has not caught up with. Resolved once here rather than at each use.
	const activeDominoTile = activeDomino ? getDomino( activeDomino ) : undefined;

	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
	const nonBotPlayers = game.context.players.filter( pid => !game.players[ pid ]?.isBot );

	const isWinner = ( pid: PlayerId ) => game.results?.ranking.some(
		s => s.playerId === pid && s.rank === 1
	) ?? false;

	return (
		<div className={ "flex flex-col gap-3 w-full max-w-6xl" }>
			<GameInfo
				id={ game.id }
				deadline={ game.runtime.deadline }
				spectators={ game.runtime.spectators }
				name={ "kingdomino" }
				additionalInfo={
					<Fragment>
						<StatBlock label={ "BOARD" }>
							{ game.config.boardSize }x{ game.config.boardSize }
						</StatBlock>
						<StatBlock label={ "PLAYERS" }>{ game.config.playerCount }</StatBlock>
					</Fragment>
				}
				completed={ game.status === "COMPLETED" }
				couchSupport
				showChat={ nonBotPlayers.length > 1 }
			/>
			{ isLobby ? (
				<Fragment>
					<PlayerLobbyGrid
						players={ game.context.players
							.map( id => game.players[ id ] )
							.filter( p => !!p ) }
						seats={ game.config.playerCount }
					/>
					<GameStatusPanel
						status={ game.status }
						seated={ game.context.players.length }
						playerCount={ game.config.playerCount }
					>
						{ game.status === "CREATED" && seated && (
							<AddBots
								addBots={ () => void addBots( { params } ) }
								disabled={ isPending }
							/>
						) }
						{ game.status === "PLAYERS_READY" && seated && (
							<StartGame
								startGame={ () => void start( { params } ) }
								disabled={ isPending }
							/>
						) }
					</GameStatusPanel>
				</Fragment>
			) : (
				<div
					className={ cn(
						"grid grid-cols-2 gap-2 justify-between",
						game.status === "COMPLETED" && "grid-cols-1 md:grid-cols-2"
					) }
				>
					{ !!game.results && (
						<div className={ "col-span-2 flex flex-col gap-2" }>
							<GameStandings
								results={ game.results }
								players={ game.players }
								playerId={ playerId }
								scoreLabel={ "POINTS" }
							/>
							<RematchPanel
								game={ "kingdomino" }
								gameId={ game.id }
								status={ game.status }
								rematch={ game.runtime.rematch }
								seated={ seated }
								rematchAtom={ rematchAtom }
							/>
						</div>
					) }
					<div className={ "col-span-2" }>
						<TurnBanner
							status={ game.status }
							players={ game.players }
							currentPlayer={ game.context.currentPlayer }
							isMyTurn={ isMyTurn }
							action={ game.context.phase === "SELECT" ? "PICKING A DOMINO" : "PLACING" }
						/>
					</div>
					{ game.context.players.map( pid => {
						const other = game.view.playerData[ pid ];
						const otherInfo = game.players[ pid ];
						if ( !other || !otherInfo ) {
							return null;
						}

						return (
							<PlayerScore
								key={ pid }
								player={ { ...otherInfo, ...other } }
								showBoard={ game.status === "COMPLETED" || !seated }
								isWinner={ isWinner( pid ) }
							/>
						);
					} ) }
					{ game.status === "IN_PROGRESS" && (
						// The kingdom and the round's draft stand side by side, so the
						// board a domino is going onto and the dominoes on offer are on
						// screen together rather than a scroll apart.
						<div className={ "col-span-2 min-w-0 flex flex-col md:flex-row gap-2 items-stretch" }>
							{ seated && (
								<div
									className={ cn(
										"min-w-0 flex-1 flex flex-col gap-2",
										"bg-background p-2 items-center rounded-md"
									) }
								>
									<div className={ "w-full overflow-x-auto" }>
										<div className={ "w-fit mx-auto" }>
											<RBoard
												board={ board }
												boardSize={ game.config.boardSize }
												isActive={ canPlace }
												onCellClick={ canPlace ? placement.handleCellClick : undefined }
												activeDominoId={ activeDomino }
												getPreviewCoords={ canPlace ? placement.getPreviewCoords : undefined }
												tentative={ placement.tentativeProp }
											/>
										</div>
									</div>
									{ canPlace && !!activeDominoTile && (
										<div className={ "flex gap-2 items-center" }>
											<RDomino domino={ activeDominoTile }/>
											{ placement.canDiscard && (
												<Button
													onClick={ placement.handleDiscard }
													disabled={ placement.isPending }
												>
													DISCARD
												</Button>
											) }
										</div>
									) }
								</div>
							) }
							<RDraft
								draft={ game.view.draft }
								players={ game.players }
								active={ canSelect }
								vertical
								onSelect={ handleDominoSelect }
								className={ "md:max-w-xs shrink-0" }
							/>
						</div>
					) }
					{ game.status !== "COMPLETED" && (
						<PickingOrder data={ game } className={ "col-span-2" }/>
					) }
					{ /* Spanning both columns so the bar's own spacer clears the whole grid. */ }
					<div className={ "col-span-2" }>
						<ActionPanel
							data={ game }
							gameId={ gameId }
							playerId={ playerId }
							acting={ canSelect || canPlace }
							isPending={ isPending }
							setAutoPlay={ enabled => void setAutoPlay( {
								params,
								payload: AutoPlayInput.make( { enabled } )
							} ) }
						/>
					</div>
				</div>
			) }
		</div>
	);
}
