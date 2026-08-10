"use client";

import type { ReactNode } from "react";

import { CouchCanvas } from "@/shared/ui/couch/couch-canvas.tsx";
import { useWakeLock } from "@/shared/ui/couch/use-wake-lock.ts";
import { Logo } from "@/shared/ui/components/logo.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

export type CouchShellProps = {
	/** The game's folder name, e.g. `"splendor"` — drives the logo and the title. */
	game: string;
	code: string;
	/** The big centre stage: the board. */
	children: ReactNode;
	/** The right rail: seats, scores, standings. */
	seats?: ReactNode;
	/** The headline strip along the bottom, e.g. "ANNA'S TURN". */
	turn?: ReactNode;
	/** Game-specific header facts (winning points, trump suit). */
	headerInfo?: ReactNode;
	/**
	 * Let the centre stage fill the whole column instead of sitting centred at its
	 * natural size — for boards that lay themselves out to the available space.
	 */
	stretch?: boolean;
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
	headerInfo,
	stretch
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
						<p className={ "text-2xl tracking-widest text-foreground/70" }>GAME CODE</p>
						<p className={ "text-7xl font-heading leading-none" }>{ code }</p>
					</div>
				</header>
				<div className={ "flex-1 min-h-0 grid grid-cols-[2fr_1fr] gap-6" }>
					<div
						className={ cn(
							"min-h-0 flex flex-col gap-4",
							stretch ? "items-stretch justify-stretch" : "items-center justify-center"
						) }
					>
						{ children }
					</div>
					<div className={ "min-h-0 flex flex-col gap-3" }>
						{ seats }
					</div>
				</div>

				{ !!turn && (
					<footer
						className={ cn(
							"bg-accent text-neutral-dark rounded-lg px-8 py-5",
							"text-5xl font-heading text-center truncate"
						) }
					>
						{ turn }
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
				<p className={ "text-4xl text-foreground/70" }>
					The shared board needs an account. Sign in here, then reopen this page.
				</p>
			</div>
		</CouchCanvas>
	);
}
