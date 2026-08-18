"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { ReactNode } from "react";

import { Logo } from "@/shared/ui/components/logo.tsx";
import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { SPRING_TIGHT } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";
import { CouchCanvas } from "@/swish/client/couch-canvas.tsx";
import { TurnTimer } from "@/swish/client/turn-timer.tsx";
import { useWakeLock } from "@/swish/client/use-wake-lock.ts";

import type { PlayerId, Roster } from "@/swish/shared/schema.ts";

export type CouchShellProps = {
	game: string;
	code: string;
	children: ReactNode;
	seats?: ReactNode;
	turn?: ReactNode;
	deadline?: number;
	headerInfo?: ReactNode;
	stretch?: boolean;
	/**
	 * The seat the footer is announcing. Supplying it (with `players`) gets the
	 * handover animation and the avatar the page banner has — across a room, a
	 * line of text quietly swapping is very easy to miss.
	 */
	currentPlayer?: PlayerId;
	players?: Roster;
};

/**
 * The chrome every couch/TV screen shares: a big header with the game and its join
 * code, a two-column body (board | seats), and a turn banner along the bottom.
 *
 * Everything here is read-only by design — no hover states, no drawers, no
 * buttons. A television has no pointer, and every action belongs on a phone.
 */
export function CouchShell( {
	game,
	code,
	children,
	seats,
	turn,
	deadline,
	headerInfo,
	stretch,
	currentPlayer,
	players
}: CouchShellProps ) {
	useWakeLock();

	return (
		<CouchCanvas>
			<div className={ "w-full h-full flex flex-col gap-6 p-10 bg-surface" }>
				<header className={ "flex items-center gap-8 bg-background rounded-lg px-8 py-5" }>
					<div className={ "flex items-center gap-5" }>
						<Logo
							url={ `/logos/${ game.toLowerCase() }.svg` }
							classname={ "bg-foreground w-20 h-20" }
						/>
						<h1 className={ "text-6xl font-title" }>{ game.toUpperCase() }</h1>
					</div>
					<div className={ "flex-1" }>{ headerInfo }</div>
					<div className={ "text-right" }>
						<p className={ "text-metric-label-lg" }>GAME CODE</p>
						<p className={ "text-7xl font-heading leading-none" }>{ code }</p>
					</div>
				</header>
				<div className={ "flex-1 min-h-0 grid grid-cols-5 gap-6" }>
					<div
						className={ cn(
							"min-h-0 flex flex-col gap-4 col-span-3",
							stretch ? "items-stretch justify-stretch" : "items-center justify-center"
						) }
					>
						{ children }
					</div>
					<div className={ "min-h-0 flex flex-col gap-3 col-span-2" }>
						{ seats }
					</div>
				</div>

					{ !!turn && (
					<footer
						className={ cn(
							"bg-accent text-neutral-dark rounded-lg px-8 py-5",
							"text-5xl font-heading flex items-center justify-center gap-8",
							"overflow-hidden"
						) }
					>
						<AnimatePresence mode={ "wait" } initial={ false }>
							<motion.div
								// Keyed on the seat where there is one, so the handover is what
								// plays rather than every re-render of the same turn.
								key={ currentPlayer ?? String( turn ) }
								className={ "flex items-center gap-6 min-w-0" }
								initial={ { opacity: 0, x: 80 } }
								animate={ { opacity: 1, x: 0 } }
								exit={ { opacity: 0, x: -80 } }
								transition={ SPRING_TIGHT }
							>
								{ !!currentPlayer && !!players?.[ currentPlayer ] && (
									<Avatar className={ "w-20 h-20 shrink-0 rounded-full" }>
										<AvatarImage
											src={ players[ currentPlayer ].avatar }
											alt={ "" }
											className={ "bg-background" }
										/>
									</Avatar>
								) }
								<span className={ "truncate" }>{ turn }</span>
							</motion.div>
						</AnimatePresence>
						<TurnTimer deadline={ deadline } large className={ "text-neutral-dark" }/>
					</footer>
				) }
			</div>
		</CouchCanvas>
	);
}

/** What a signed-out television shows — readable from a sofa, and actionable on a phone. */
export function CouchSignedOut() {
	return (
		<CouchCanvas>
			<div
				className={ cn(
					"w-full h-full bg-surface flex flex-col gap-8",
					"items-center justify-center text-center px-20"
				) }
			>
				<h1 className={ "text-7xl font-title" }>SIGN IN ON THIS SCREEN</h1>
				<p className={ "text-4xl text-muted-foreground" }>
					The shared board needs an account. Sign in here, then reopen this page.
				</p>
			</div>
		</CouchCanvas>
	);
}
