"use client";

import { CounterTween } from "@/shared/ui/components/counter-tween.tsx";
import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { PlayerLobbyGrid } from "@/shared/ui/components/player-lobby.tsx";
import { StartGame } from "@/shared/ui/components/start-game.tsx";
import { ControllerShell } from "@/shared/ui/couch/controller-shell.tsx";
import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { GEMS } from "@/games/splendor/shared/utils.ts";
import { startGameFn } from "@/games/splendor/client/client.ts";
import { BuySheet } from "@/games/splendor/client/buy-sheet.tsx";
import { useSplendor } from "@/games/splendor/client/context.tsx";
import { GameCard } from "@/games/splendor/client/game-card.tsx";
import { PickTokens } from "@/games/splendor/client/pick-tokens.tsx";
import { ReservedCardAction } from "@/games/splendor/client/reserved-card-action.tsx";
import { TokenBar } from "@/games/splendor/client/token-bar.tsx";

/**
 * The phone half. Shows this seat's own state and the actions it can take; the
 * board, the opponents and the animations are on the television.
 *
 * `PickTokens` is reused verbatim — it already renders the shared token pool
 * inside its own sheet, which is exactly the "compact board context" an action
 * needs. `BuySheet` does the same for cards.
 */
export function ControllerView() {
	const { data } = useSplendor();

	const me = data.view.playerId;
	const isMyTurn = data.status === "IN_PROGRESS" && data.context.currentPlayer === me;
	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const myData = data.view.playerData[ me ];
	const myInfo = data.players[ me ];

	// Grouped by the bonus gem they discount, cheapest level first — the same order
	// `PlayerTableau` uses, so a seat's engine reads the same on every screen.
	const purchased = GEMS.flatMap( gem => myData.cards
		.filter( card => card.bonus === gem )
		.toSorted( ( a, b ) => a.level - b.level ) );

	const waitingFor = data.players[ data.context.currentPlayer ]?.name;

	return (
		<ControllerShell
			game={ "splendor" }
			code={ data.code }
			isMyTurn={ isMyTurn || isLobby }
			waitingFor={ waitingFor }
			channelId={ data.id }
			actions={
				<>
					{ data.status === "PLAYERS_READY" && (
						<StartGame
							gameId={ data.id }
							queryKey={ [ "splendor", "getState", data.id ] }
							startGame={ startGameFn }
						/>
					) }
					{ isMyTurn && <PickTokens/> }
					{ isMyTurn && <BuySheet/> }
				</>
			}
		>
			{ isLobby && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<p className={ "text-lg font-heading text-center" }>
						YOU'RE SEATED
					</p>
					<PlayerLobbyGrid
						players={ data.context.players.map( id => data.players[ id ] ) }
					/>
				</div>
			) }

			{ data.status === "IN_PROGRESS" && (
				<div className={ "flex flex-col gap-3 w-full" }>
					{ /*
					  * Just who I am and where I stand. The full `PlayerInfo` repeats the
					  * gem counters that the purchased and token sections below now show
					  * properly, and the whole board is on the television anyway.
					  */ }
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
							<span className={ "text-[10px] tracking-widest text-foreground/70" }>
								POINTS
							</span>
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
						<p className={ "text-xs tracking-widest text-foreground/70" }>MY RESERVED</p>
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
						<p className={ "text-xs tracking-widest text-foreground/70" }>
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
					<p className={ "text-lg font-heading" }>GAME OVER</p>
					<GameStandings
						results={ data.results }
						players={ data.players }
						playerId={ me }
						scoreLabel={ "POINTS" }
					/>
				</div>
			) }
		</ControllerShell>
	);
}
