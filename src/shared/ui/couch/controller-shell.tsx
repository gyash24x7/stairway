"use client";

import type { ReactNode } from "react";

import { ChatPanel } from "@/chat/client/chat-panel.tsx";
import { Logo } from "@/shared/ui/components/logo.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

export type ControllerShellProps = {
	/** The game's folder name, e.g. `"splendor"`. */
	game: string;
	code: string;
	/** Whether it is this player's turn — drives the waiting state in the action bar. */
	isMyTurn: boolean;
	/** Who we're waiting on, shown when it isn't your turn. */
	waitingFor?: string;
	/** The chat channel (the game id). Omit to hide chat. */
	channelId?: string;
	/** Your private state plus whatever compact board context the actions need. */
	children: ReactNode;
	/** The sticky bottom bar. Only rendered on your turn. */
	actions?: ReactNode;
};

/**
 * The phone half of couch mode. Deliberately keeps the app navbar (a phone wants
 * log-out, theme and home), and gives the whole bottom of the screen to actions —
 * the board itself is on the television.
 */
export function ControllerShell( {
	game,
	code,
	isMyTurn,
	waitingFor,
	channelId,
	children,
	actions
}: ControllerShellProps ) {
	return (
		<div className={ "flex flex-col gap-3 items-center max-w-lg w-full pb-44" }>
			<div className={ "flex gap-2 items-center w-full rounded-md bg-background p-2" }>
				<Logo
					url={ `/logos/${ game.toLowerCase() }.svg` }
					classname={ "bg-foreground w-8 h-8 shrink-0" }
				/>
				<div className={ "flex-1 min-w-0" }>
					<p className={ "text-[10px] tracking-widest text-foreground/70" }>CODE</p>
					<p className={ "text-lg font-heading leading-none truncate" }>{ code }</p>
				</div>
				{ !!channelId && <ChatPanel channelId={ channelId }/> }
			</div>

			{ children }

			<div
				className={ cn(
					"fixed left-0 right-0 bottom-0 bg-surface z-10",
					"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
				) }
			>
				{ isMyTurn
					? <div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>{ actions }</div>
					: (
						<div className={ "flex gap-3 items-center text-foreground/70" }>
							<Spinner/>
							<span className={ "font-heading" }>
								{ waitingFor ? `WAITING FOR ${ waitingFor.toUpperCase() }` : "WAITING" }
							</span>
						</div>
					) }
			</div>
		</div>
	);
}
