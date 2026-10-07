import { cn } from "cn";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import { SPRING_TIGHT } from "@/shared/shell/animation";
import { Logo } from "@/shared/shell/logo";
import type { PlayerId, Roster } from "@/swish/schema";
import { CouchCanvas } from "@/swish/ui/couch-canvas";
import { TurnTimer } from "@/swish/ui/turn-timer";


export type CouchShellProps = {
	game: string;
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
	/**
	 * A full-width strip between the body and the turn footer, for a fact the room
	 * has to act on somewhere else — the rematch and its code. Still not a control:
	 * this screen has no pointer, so it states things rather than offering them.
	 */
	notice?: ReactNode;
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
	children,
	seats,
	turn,
	deadline,
	headerInfo,
	stretch,
	currentPlayer,
	players,
	notice
}: CouchShellProps ) {

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

				{ notice }

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
								<span className={ "truncate uppercase" }>{ turn }</span>
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
