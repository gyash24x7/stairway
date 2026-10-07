import * as HashSet from "effect/HashSet";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { cn } from "cn";
import { motion } from "framer-motion";

import type { TicTacToeConfig, TicTacToeView } from "@/games/tictactoe/schema";
import { TicTacToeBoard } from "@/games/tictactoe/ui/board";
import {
	addBotsAtom,
	autoPlayAtom,
	placeAtom,
	rematchAtom,
	startGameAtom
} from "@/games/tictactoe/ui/client";
import { TicTacToeHint } from "@/games/tictactoe/ui/hint";
import type { GameView, PlayerId } from "@/swish/schema";
import { AutoPlayInput, GameId } from "@/swish/schema";
import { GameInfo } from "@/swish/ui/game-info";
import { GameStandings } from "@/swish/ui/game-standings";
import { GameStatusPanel } from "@/swish/ui/game-status-panel";
import { RPlayerInfoSmall } from "@/swish/ui/player-info";
import { RematchPanel } from "@/swish/ui/rematch";
import { AddBots, AutoPlayToggle, StartGame } from "@/swish/ui/seat-controls";
import { TurnBanner } from "@/swish/ui/turn-banner";


export type TicTacToeGameViewProps = {
	readonly game: GameView<TicTacToeView, TicTacToeConfig>;
	readonly gameId: string;
	readonly me: PlayerId;
};

export function TicTacToeGameView( { game, gameId, me }: TicTacToeGameViewProps ) {
	const place = useAtomSet( placeAtom, { mode: "promiseExit" } );
	const addBots = useAtomSet( addBotsAtom, { mode: "promiseExit" } );
	const start = useAtomSet( startGameAtom, { mode: "promiseExit" } );
	const setAutoPlay = useAtomSet( autoPlayAtom, { mode: "promiseExit" } );

	const placing = useAtomValue( placeAtom ).waiting;
	const adding = useAtomValue( addBotsAtom ).waiting;
	const starting = useAtomValue( startGameAtom ).waiting;
	const switching = useAtomValue( autoPlayAtom ).waiting;

	const params = { gameId: GameId.make( gameId ) };

	const players = Object.values( game.players );
	const isActive = game.status === "IN_PROGRESS";
	const isCompleted = game.status === "COMPLETED";
	const isMyTurn = game.context.currentPlayer === me;
	const nonBotPlayers = game.context.players.filter( pid => !game.players[ pid ]?.isBot );

	const seated = game.players[ me ] !== undefined;
	const autoPlaying = HashSet.has( game.runtime.autoPlay, me );

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full" }>
			<GameInfo
				id={ game.id }
				deadline={ game.runtime.deadline }
				spectators={ game.runtime.spectators }
				name={ "tictactoe" }
				showChat={ nonBotPlayers.length > 1 }
				completed={ isCompleted }
			/>

			<GameStatusPanel
				status={ game.status }
				seated={ game.context.players.length }
				playerCount={ game.config.playerCount }
				hint={ "Share the game code to invite a player." }
			>
				{ seated && game.status === "CREATED" && (
					<AddBots addBots={ () => void addBots( { params } ) } disabled={ adding }/>
				) }
				{ seated && game.status === "PLAYERS_READY" && (
					<StartGame startGame={ () => void start( { params } ) } disabled={ starting }/>
				) }
			</GameStatusPanel>

			<GameStandings
				results={ game.results }
				players={ game.players }
				playerId={ me }
			/>

			<RematchPanel
				game={ "tictactoe" }
				gameId={ game.id }
				status={ game.status }
				rematch={ game.runtime.rematch }
				seated={ seated }
				rematchAtom={ rematchAtom }
			/>

			<TurnBanner
				status={ game.status }
				players={ game.players }
				currentPlayer={ game.context.currentPlayer }
				isMyTurn={ isMyTurn }
			/>

			<TicTacToeBoard
				board={ game.view.board }
				disabled={ !isActive || !isMyTurn || placing }
				onPlace={ position => void place( { params, payload: { position } } ) }
			/>

			{ isActive && seated && (
				<div className={ "flex gap-2 items-center" }>
					<AutoPlayToggle
						autoPlaying={ autoPlaying }
						setAutoPlay={ enabled => void setAutoPlay( {
							params,
							payload: AutoPlayInput.make( { enabled } )
						} ) }
						disabled={ switching }
					/>
					<TicTacToeHint gameId={ gameId } disabled={ !isMyTurn }/>
				</div>
			) }

			{ players.length > 0 && (
				<div
					className={ cn(
						"flex justify-around border-2 rounded-md",
						"bg-background w-full max-w-xl"
					) }
				>
					{ players.map( ( p, index ) => {
						const isCurrent = game.context.currentPlayer === p.id && isActive;
						return (
							<div
								key={ p.id }
								className={ "relative flex items-center gap-2 p-2 rounded-base" }
							>
								<span className={ "text-2xl font-title" }>
									{ index === 0 ? "X" : "O" }
								</span>
								<RPlayerInfoSmall player={ p }/>
								{ isCurrent && (
									<motion.span
										className={ "text-xs text-accent" }
										animate={ { opacity: [ 0.4, 1, 0.4 ], scale: [ 1, 1.3, 1 ] } }
										transition={ { duration: 1.4, repeat: Infinity, ease: "easeInOut" } }
									>
										●
									</motion.span>
								) }
							</div>
						);
					} ) }
				</div>
			) }
		</div>
	);
}
