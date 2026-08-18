"use client";

import type { ReactNode } from "react";

import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { GameStatus } from "@/swish/shared/schema.ts";

export type GameStatusPanelProps = {
	status: GameStatus;
	seated: number;
	playerCount: number;
	/** A line under the headline, for a game whose lobby has a decision in it. */
	hint?: string;
	/** Lobby controls — add bots, start. Laid out for the caller. */
	children?: ReactNode;
	className?: string;
};

/**
 * The lobby's headline: how full the table is, and whether it is waiting on
 * people or on someone to press start.
 *
 * The copy is derived here rather than passed in, because six games phrasing the
 * same two states six ways is what this replaces. It deliberately sits on
 * `bg-background` and never on `bg-accent` — accent means "you" across the app,
 * and a table waiting on nobody in particular is not that.
 *
 * Renders nothing once the game is under way; `TurnBanner` and `GameStandings`
 * own every later state, so this is safe to mount unconditionally.
 */
export function GameStatusPanel( props: GameStatusPanelProps ) {
	const { status, seated, playerCount, hint, children, className } = props;

	if ( status !== "CREATED" && status !== "PLAYERS_READY" ) {
		return null;
	}

	const waiting = status === "CREATED";

	return (
		<div
			className={ cn(
				"p-3 rounded-md w-full bg-background",
				"flex flex-col gap-2 items-center text-center",
				className
			) }
		>
			{ waiting && <Spinner size={ "xl" }/> }
			<p className={ "text-status" }>
				{ waiting
					? `WAITING FOR PLAYERS — ${ seated }/${ playerCount } SEATED`
					: "ALL PLAYERS JOINED" }
			</p>
			{ !!hint && <p className={ "text-xs md:text-sm text-muted-foreground" }>{ hint }</p> }
			{ !!children && (
				<div className={ "flex gap-2 flex-wrap justify-center" }>{ children }</div>
			) }
		</div>
	);
}
