"use client";

import { BuySheet } from "@/games/splendor/client/buy-sheet.tsx";
import { ClaimNoble } from "@/games/splendor/client/claim-noble.tsx";
import { useSplendor } from "@/games/splendor/client/context.tsx";
import { GameCard } from "@/games/splendor/client/game-card.tsx";
import { PickTokens } from "@/games/splendor/client/pick-tokens.tsx";
import { ReservedCardAction } from "@/games/splendor/client/reserved-card-action.tsx";
import { TokenBar } from "@/games/splendor/client/token-bar.tsx";
import { GEMS } from "@/games/splendor/shared/utils.ts";
import { CounterTween } from "@/shared/ui/components/counter-tween.tsx";
import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { ControllerShell } from "@/swish/client/controller-shell.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { PlayerLobbyGrid } from "@/swish/client/player-lobby.tsx";
import { Rematch } from "@/swish/client/rematch.tsx";
import { AddBots, AutoPlayToggle } from "@/swish/client/seat-controls.tsx";
import { StartGame } from "@/swish/client/start-game.tsx";

/**
 * The phone half. Shows this seat's own state and the actions it can take; the
 * board, the opponents and the animations are on the television.
 *
 * `PickTokens` is reused verbatim — it already renders the shared token pool
 * inside its own sheet, which is exactly the "compact board context" an action
 * needs. `BuySheet` does the same for cards.
 */
export function ControllerView() {
	const {
		data,
		playerId,
		isMyTurn,
		mustPass,
		pass,
		addBots,
		startGame,
		setAutoPlay,
		startRematch,
		isPending
	} = useSplendor();

	const humans = data.context.players.filter( pid => !data.players[ pid ].isBot ).length;

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const myData = playerId ? data.view.playerData[ playerId ] : undefined;
	const myInfo = playerId ? data.players[ playerId ] : undefined;
	const autoPlaying = !!playerId && ( data.autoPlay[ playerId ] ?? false );

	// Grouped by the bonus gem they discount, cheapest level first — the same order
	// `PlayerTableau` uses, so a seat's engine reads the same on every screen.
	const purchased = GEMS.flatMap( gem => ( myData?.cards ?? [] )
		.filter( card => card.bonus === gem )
		.toSorted( ( a, b ) => a.level - b.level ) );

	const waitingFor = data.players[ data.context.currentPlayer ]?.name;

	return (
		<ControllerShell
			game={ "splendor" }
			code={ data.code }
			isMyTurn={ isMyTurn || isLobby }
			waitingFor={ waitingFor }
			deadline={ data.deadline }
			completed={ data.status === "COMPLETED" }
			channelId={ data.id }
			persistentActions={ data.status === "IN_PROGRESS" && (
				<AutoPlayToggle
					autoPlaying={ autoPlaying }
					setAutoPlay={ setAutoPlay }
					disabled={ isPending }
				/>
			) }
			actions={
				<>
					{ data.status === "CREATED" && (
						<AddBots addBots={ addBots } disabled={ isPending }/>
					) }
					{ data.status === "PLAYERS_READY" && (
						<StartGame startGame={ startGame } disabled={ isPending }/>
					) }
					{ isMyTurn && !autoPlaying && !mustPass && <PickTokens/> }
					{ isMyTurn && !autoPlaying && !mustPass && <BuySheet/> }
					{ isMyTurn && !autoPlaying && mustPass && (
						<Button onClick={ pass } disabled={ isPending } className={ "flex-1" }>
							{ isPending ? <Spinner/> : "PASS TURN" }
						</Button>
					) }
				</>
			}
		>
			{ isLobby && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<p className={ "text-lg font-heading text-center" }>YOU&apos;RE SEATED</p>
					<PlayerLobbyGrid
						players={ data.context.players.map( id => data.players[ id ] ) }
					/>
				</div>
			) }

			{ data.status === "IN_PROGRESS" && !!myData && !!myInfo && (
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
									<ReservedCardAction key={ card.id } card={ card }/>
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

			{ data.status === "COMPLETED" && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<GameStandings
						results={ data.results }
						players={ data.players }
						playerId={ playerId }
						scoreLabel={ "POINTS" }
					/>

					<Rematch
						game={ "splendor" }
						screen={ "controller" }
						completed
						rematch={ data.rematch }
						startRematch={ playerId ? startRematch : undefined }
						humans={ humans }
						disabled={ isPending }
					/>
				</div>
			) }

			<ClaimNoble/>
		</ControllerShell>
	);
}
