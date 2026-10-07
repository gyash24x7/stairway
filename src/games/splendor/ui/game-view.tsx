import * as HashSet from "effect/HashSet";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { UsersIcon } from "lucide-react";
import { useState } from "react";

import type { SplendorConfig, SplendorView } from "@/games/splendor/schema";
import { SPLENDOR_NOBLE_VISIT } from "@/games/splendor/schema";
import { Board } from "@/games/splendor/ui/board";
import { CardActions } from "@/games/splendor/ui/card-actions";
import { ClaimNoble } from "@/games/splendor/ui/claim-noble";
import {
	addBotsAtom,
	autoPlayAtom,
	passAtom,
	rematchAtom,
	startGameAtom
} from "@/games/splendor/ui/client";
import { SplendorHint } from "@/games/splendor/ui/hint";
import { PickTokens } from "@/games/splendor/ui/pick-tokens";
import { PlayerInfo } from "@/games/splendor/ui/player-info";
import { PlayerTableau } from "@/games/splendor/ui/player-tableau";
import { ReservedCardsDrawer } from "@/games/splendor/ui/reserved-cards";
import { hasLegalMove } from "@/games/splendor/utils";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import type { GameView, PlayerId } from "@/swish/schema";
import { AutoPlayInput, GameId } from "@/swish/schema";
import { ActionBar } from "@/swish/ui/action-bar";
import { GameInfo } from "@/swish/ui/game-info";
import { GameStandings } from "@/swish/ui/game-standings";
import { GameStatusPanel } from "@/swish/ui/game-status-panel";
import { PlayerLobbyGrid } from "@/swish/ui/player-lobby";
import { RematchPanel } from "@/swish/ui/rematch";
import { AddBots, AutoPlayToggle, StartGame } from "@/swish/ui/seat-controls";
import { StatBlock } from "@/swish/ui/stat-block";
import { TurnBanner } from "@/swish/ui/turn-banner";
import { activeFrame } from "@/swish/utils";


type Game = GameView<SplendorView, SplendorConfig>;

export type SplendorGameViewProps = {
	readonly game: Game;
	readonly gameId: string;
	readonly me: PlayerId;
};

export function SplendorGameView( { game, gameId, me }: SplendorGameViewProps ) {
	const addBots = useAtomSet( addBotsAtom, { mode: "promiseExit" } );
	const start = useAtomSet( startGameAtom, { mode: "promiseExit" } );
	const setAutoPlay = useAtomSet( autoPlayAtom, { mode: "promiseExit" } );
	const pass = useAtomSet( passAtom, { mode: "promiseExit" } );

	const adding = useAtomValue( addBotsAtom ).waiting;
	const starting = useAtomValue( startGameAtom ).waiting;
	const switching = useAtomValue( autoPlayAtom ).waiting;
	const passing = useAtomValue( passAtom ).waiting;
	const isPending = adding || starting || switching || passing;

	const [ playersOpen, setPlayersOpen ] = useState( false );

	const params = { gameId: GameId.make( gameId ) };

	const myData = game.view.playerData[ me ];

	/**
	 * The noble choice, when the table is waiting on this seat to make it.
	 *
	 * Read off the open window rather than worked out from the cards: two nobles
	 * being willing is what *opens* it, and the engine awards a lone one without
	 * asking — so a seat that qualifies for one noble is not being asked anything.
	 */
	const nobleFrame = activeFrame( game.context );
	const awaitingNoble = nobleFrame?.kind === SPLENDOR_NOBLE_VISIT
		&& nobleFrame.pending.includes( me );
	const myInfo = game.players[ me ];
	const hasSeat = myInfo !== undefined;
	const isMyTurn = game.status === "IN_PROGRESS" && game.context.currentPlayer === me;
	const mustPass = isMyTurn && !!myData && !hasLegalMove( game.view, myData );

	const isPlaying = game.status === "IN_PROGRESS";
	const isLastRound = isPlaying && Object.values( game.view.playerData )
		.some( p => p.points >= game.config.winningPoints );

	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
	const autoPlaying = HashSet.has( game.runtime.autoPlay, me );
	const nonBotPlayers = game.context.players.filter( pid => !game.players[ pid ]?.isBot );

	// A seat is only renderable with both halves of it — its roster entry and its
	// tableau. Resolved once here so the places that list seats cannot disagree
	// about which ones exist, and none of them has to assert that they do.
	const seats = game.context.players.flatMap( id => {
		const player = game.players[ id ];
		const playerData = game.view.playerData[ id ];
		return player && playerData ? [ { id, player, playerData } ] : [];
	} );
	const otherSeats = seats.filter( seat => seat.id !== me );

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full" }>
			<GameInfo
				id={ game.id }
				deadline={ game.runtime.deadline }
				spectators={ game.runtime.spectators }
				name={ "splendor" }
				completed={ game.status === "COMPLETED" }
				additionalInfo={
					<StatBlock label={ "WINNING POINTS" }>{ game.config.winningPoints }</StatBlock>
				}
				couchSupport
				showChat={ nonBotPlayers.length > 1 }
			/>
			<GameStandings
				results={ game.results }
				players={ game.players }
				playerId={ me }
				scoreLabel={ "POINTS" }
			/>
			<RematchPanel
				game={ "splendor" }
				gameId={ game.id }
				status={ game.status }
				rematch={ game.runtime.rematch }
				seated={ hasSeat }
				rematchAtom={ rematchAtom }
			/>

			{ isLobby && (
				<PlayerLobbyGrid
					players={ game.context.players.flatMap(
						id => game.players[ id ] ? [ game.players[ id ] ] : []
					) }
					seats={ game.config.playerCount }
				/>
			) }
			{ game.status === "COMPLETED" && (
				<div className={ "grid grid-cols-1 md:grid-cols-2 gap-3 w-full" }>
					{ seats.map( ( { id, player, playerData } ) => (
						<PlayerTableau
							key={ id }
							player={ player }
							cards={ playerData.cards }
							nobles={ playerData.nobles }
						/>
					) ) }
				</div>
			) }
			<GameStatusPanel
				status={ game.status }
				seated={ game.context.players.length }
				playerCount={ game.config.playerCount }
			>
				{ hasSeat && game.status === "CREATED" && (
					<AddBots
						addBots={ () => void addBots( { params } ) }
						disabled={ isPending }
					/>
				) }
				{ hasSeat && game.status === "PLAYERS_READY" && (
					<StartGame
						startGame={ () => void start( { params } ) }
						disabled={ isPending }
					/>
				) }
			</GameStatusPanel>

			<TurnBanner
				status={ game.status }
				players={ game.players }
				currentPlayer={ game.context.currentPlayer }
				isMyTurn={ isMyTurn }
				note={ isLastRound ? "LAST ROUND!" : undefined }
			/>

			{ isPlaying && (
				<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full justify-items-center" }>
					<div className={ "flex flex-col gap-3 w-full max-w-lg md:max-w-xl items-center" }>
						<Board
							cards={ game.view.cards }
							nobles={ game.view.nobles }
							playerCount={ game.config.playerCount }
							renderCard={ card => (
								<CardActions
									card={ card }
									gameId={ gameId }
									isMyTurn={ isMyTurn }
									me={ myData }
									bankGold={ game.view.tokens.gold }
								/>
							) }
						/>
						<PickTokens
							gameId={ gameId }
							isMyTurn={ isMyTurn }
							availableTokens={ game.view.tokens }
							playerTokens={ myData?.tokens }
						/>
						<Button
							variant={ "neutral" }
							className={ "w-full flex gap-2 items-center justify-center lg:hidden" }
							onClick={ () => setPlayersOpen( true ) }
						>
							<UsersIcon className={ "w-4 h-4" }/>
							<span>VIEW OTHER PLAYERS</span>
						</Button>
					</div>
					<div className={ "hidden lg:flex flex-col gap-3 w-full max-w-lg md:max-w-xl" }>
						{ seats.map( ( { id, player, playerData } ) => (
							<PlayerInfo
								key={ id }
								player={ player }
								playerData={ playerData }
								isCurrentTurn={ isPlaying && game.context.currentPlayer === id }
								reservedSlot={
									<ReservedCardsDrawer
										gameId={ gameId }
										playerName={ player.name }
										reserved={ playerData.reserved }
										isOwnCards={ id === me }
										isMyTurn={ isMyTurn }
										myTokens={ myData?.tokens }
										myDiscounts={ myData?.cards }
									/>
								}
							/>
						) ) }
					</div>
				</div>
			) }
			{ isPlaying && (
				<Drawer open={ playersOpen } onOpenChange={ setPlayersOpen }>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle>OTHER PLAYERS</DrawerTitle>
							<DrawerDescription/>
						</DrawerHeader>
						<div className={ "px-4 flex flex-col gap-2 overflow-y-scroll max-h-100" }>
							{ otherSeats.map( ( { id, player, playerData } ) => (
								<PlayerInfo
									key={ id }
									player={ player }
									playerData={ playerData }
									isCurrentTurn={ isPlaying && game.context.currentPlayer === id }
									bg
									reservedSlot={
										<ReservedCardsDrawer
											gameId={ gameId }
											playerName={ player.name }
											reserved={ playerData.reserved }
											isOwnCards={ false }
											isMyTurn={ isMyTurn }
											myTokens={ myData?.tokens }
											myDiscounts={ myData?.cards }
										/>
									}
								/>
							) ) }
						</div>
						<DrawerFooter/>
					</DrawerContent>
				</Drawer>
			) }
			{ isPlaying && (
				<ActionBar>
					{ !!myData && !!myInfo && (
						<div className={ "w-full max-w-lg md:max-w-xl lg:hidden" }>
							<PlayerInfo
								player={ myInfo }
								playerData={ myData }
								isCurrentTurn={ isMyTurn }
								reservedSlot={
									<ReservedCardsDrawer
										gameId={ gameId }
										playerName={ myInfo.name }
										reserved={ myData.reserved }
										isOwnCards
										isMyTurn={ isMyTurn }
										myTokens={ myData.tokens }
										myDiscounts={ myData.cards }
									/>
								}
							/>
						</div>
					) }
					{ hasSeat && (
						<AutoPlayToggle
							autoPlaying={ autoPlaying }
							setAutoPlay={ enabled => void setAutoPlay( {
								params,
								payload: AutoPlayInput.make( { enabled } )
							} ) }
							disabled={ isPending }
						/>
					) }
					{ hasSeat && (
						<SplendorHint
							game={ game }
							gameId={ gameId }
							disabled={ !isMyTurn && !awaitingNoble }
						/>
					) }
					{ mustPass && (
						<Button
							onClick={ () => void pass( { params, payload: {} } ) }
							disabled={ isPending }
						>
							{ passing ? <Spinner/> : "PASS TURN" }
						</Button>
					) }
				</ActionBar>
			) }
			<ClaimNoble
				gameId={ gameId }
				awaiting={ awaitingNoble }
				frameId={ nobleFrame?.id }
				myCards={ myData?.cards ?? [] }
				nobles={ game.view.nobles }
			/>
		</div>
	);
}
