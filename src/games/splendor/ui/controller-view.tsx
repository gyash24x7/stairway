import * as HashSet from "effect/HashSet";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { cn } from "cn";

import type { SplendorConfig, SplendorView } from "@/games/splendor/schema";
import { SPLENDOR_NOBLE_VISIT } from "@/games/splendor/schema";
import { BuySheet } from "@/games/splendor/ui/buy-sheet";
import { ClaimNoble } from "@/games/splendor/ui/claim-noble";
import {
	addBotsAtom,
	autoPlayAtom,
	passAtom,
	rematchAtom,
	startGameAtom
} from "@/games/splendor/ui/client";
import { GameCard } from "@/games/splendor/ui/game-card";
import { SplendorHint } from "@/games/splendor/ui/hint";
import { PickTokens } from "@/games/splendor/ui/pick-tokens";
import { ReservedCardAction } from "@/games/splendor/ui/reserved-card-action";
import { TokenBar } from "@/games/splendor/ui/token-bar";
import { GEMS, hasLegalMove } from "@/games/splendor/utils";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { CounterTween } from "@/shared/shell/counter-tween";
import type { GameView, PlayerId } from "@/swish/schema";
import { AutoPlayInput, GameId } from "@/swish/schema";
import { ControllerShell } from "@/swish/ui/controller-shell";
import { GameStandings } from "@/swish/ui/game-standings";
import { RematchPanel } from "@/swish/ui/rematch";
import { AddBots, AutoPlayToggle, StartGame } from "@/swish/ui/seat-controls";
import { activeFrame } from "@/swish/utils";


type Game = GameView<SplendorView, SplendorConfig>;

export type ControllerViewProps = {
	readonly game: Game;
	readonly gameId: string;
	readonly me: PlayerId;
};

/**
 * The phone half. Shows this seat's own state and the actions it can take; the
 * board, the opponents and the animations are on the television.
 *
 * `PickTokens` is reused verbatim — it already renders the shared token pool
 * inside its own sheet, which is exactly the "compact board context" an action
 * needs. `BuySheet` does the same for cards.
 */
export function ControllerView( { game, gameId, me }: ControllerViewProps ) {
	const addBots = useAtomSet( addBotsAtom, { mode: "promiseExit" } );
	const start = useAtomSet( startGameAtom, { mode: "promiseExit" } );
	const setAutoPlay = useAtomSet( autoPlayAtom, { mode: "promiseExit" } );
	const pass = useAtomSet( passAtom, { mode: "promiseExit" } );

	const adding = useAtomValue( addBotsAtom ).waiting;
	const starting = useAtomValue( startGameAtom ).waiting;
	const switching = useAtomValue( autoPlayAtom ).waiting;
	const passing = useAtomValue( passAtom ).waiting;
	const isPending = adding || starting || switching || passing;

	const params = { gameId: GameId.make( gameId ) };

	const isMyTurn = game.status === "IN_PROGRESS" && game.context.currentPlayer === me;
	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
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
	const autoPlaying = HashSet.has( game.runtime.autoPlay, me );
	const mustPass = isMyTurn && !!myData && !hasLegalMove( game.view, myData );

	// Grouped by the bonus gem they discount, cheapest level first — the same order
	// `PlayerTableau` uses, so a seat's engine reads the same on every screen.
	const purchased = GEMS.flatMap( gem => ( myData?.cards ?? [] )
		.filter( card => card.bonus === gem )
		.toSorted( ( a, b ) => a.level - b.level ) );

	const waitingFor = game.context.currentPlayer
		? game.players[ game.context.currentPlayer ]?.name
		: undefined;

	return (
		<ControllerShell
			game={ "splendor" }
			deadline={ game.runtime.deadline }
			isMyTurn={ isMyTurn || isLobby }
			waitingFor={ waitingFor }
			completed={ game.status === "COMPLETED" }
			persistentActions={ game.status === "IN_PROGRESS" && hasSeat && (
				<>
					<AutoPlayToggle
						autoPlaying={ autoPlaying }
						setAutoPlay={ enabled => void setAutoPlay( {
							params,
							payload: AutoPlayInput.make( { enabled } )
						} ) }
						disabled={ isPending }
					/>
					<SplendorHint game={ game } gameId={ gameId } disabled={ !isMyTurn }/>
				</>
			) }
			actions={
				<>
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
					{ isMyTurn && !autoPlaying && !mustPass && (
						<PickTokens
							gameId={ gameId }
							isMyTurn={ isMyTurn }
							availableTokens={ game.view.tokens }
							playerTokens={ myData?.tokens }
						/>
					) }
					{ isMyTurn && !autoPlaying && !mustPass && myData && (
						<BuySheet
							gameId={ gameId }
							me={ myData }
							cards={ game.view.cards }
							goldAvailable={ game.view.tokens.gold > 0 }
						/>
					) }
					{ isMyTurn && !autoPlaying && mustPass && (
						<Button
							onClick={ () => void pass( { params, payload: {} } ) }
							disabled={ isPending }
							className={ "flex-1" }
						>
							{ passing ? <Spinner/> : "PASS TURN" }
						</Button>
					) }
				</>
			}
		>
			{ isLobby && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<p className={ "text-lg font-heading text-center" }>YOU&apos;RE SEATED</p>
				</div>
			) }

			{ game.status === "IN_PROGRESS" && !!myData && !!myInfo && (
				<div className={ "flex flex-col gap-3 w-full" }>
					<div
						className={ cn(
							"grid grid-cols-2 items-center gap-2",
							"bg-background rounded-md p-3"
						) }
					>
						<div className={ "flex items-center gap-2 min-w-0" }>
							<Avatar className={ "rounded-full w-10 h-10 shrink-0" }>
								<AvatarImage src={ myInfo.avatar } alt={ "" } className={ "bg-accent" }/>
							</Avatar>
							<span className={ "truncate font-heading text-lg" }>
								{ myInfo.name.toUpperCase() }
							</span>
						</div>
						<div className={ "flex flex-col items-end" }>
							<span className={ "text-[10px] tracking-widest text-muted-foreground" }>POINTS</span>
							<span className={ "font-heading text-3xl leading-none" }>
								<CounterTween value={ myData.points }/>
							</span>
						</div>
					</div>

					<TokenBar
						tokens={ myData.tokens }
						tokenText={ "MY TOKENS" }
						onTokenClick={ () => undefined }
						disabled
					/>

					<div className={ "flex flex-col gap-2 bg-background rounded-md p-3" }>
						<p className={ "text-xs tracking-widest text-muted-foreground" }>MY RESERVED</p>
						{ myData.reserved.length > 0 ? (
							<div className={ "flex flex-wrap gap-2 justify-center" }>
								{ /* Tap one to buy it — the buy sheet is the board only. */ }
								{ myData.reserved.map( card => (
									<ReservedCardAction
										key={ card.id }
										card={ card }
										gameId={ gameId }
										isMyTurn={ isMyTurn }
										tokens={ myData.tokens }
										discounts={ myData.cards }
									/>
								) ) }
							</div>
						) : (
							<p className={ "text-sm text-center text-muted-foreground" }>
								NO RESERVED CARDS
							</p>
						) }
					</div>

					<div className={ "flex flex-col gap-2 bg-background rounded-md p-3" }>
						<p className={ "text-xs tracking-widest text-muted-foreground" }>
							MY CARDS ({ myData.cards.length })
						</p>
						{ purchased.length > 0 ? (
							<div className={ "flex flex-wrap gap-2 justify-center" }>
								{ purchased.map( card => (
									<GameCard key={ card.id } card={ card } disabled/>
								) ) }
							</div>
						) : (
							<p className={ "text-sm text-center text-muted-foreground" }>
								NO CARDS PURCHASED
							</p>
						) }
					</div>
				</div>
			) }

			{ game.status === "COMPLETED" && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
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
						surface={ "controller" }
					/>
				</div>
			) }

			<ClaimNoble
				gameId={ gameId }
				awaiting={ awaitingNoble }
				frameId={ nobleFrame?.id }
				myCards={ myData?.cards ?? [] }
				nobles={ game.view.nobles }
			/>
		</ControllerShell>
	);
}
