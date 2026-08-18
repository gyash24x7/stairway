"use client";

import type { ReactNode } from "react";

import { ChatPanel } from "@/chat/client/chat-panel.tsx";
import { Logo } from "@/shared/ui/components/logo.tsx";
import { ActionBar } from "@/swish/client/action-bar.tsx";
import { TurnTimer } from "@/swish/client/turn-timer.tsx";

export type ControllerShellProps = {
	game: string;
	code: string;
	isMyTurn: boolean;
	waitingFor?: string;
	deadline?: number;
	completed?: boolean;
	channelId?: string;
	children: ReactNode;
	actions?: ReactNode;
	/** Controls offered whether or not it is this seat's turn. */
	persistentActions?: ReactNode;
};

/**
 * The phone half of couch mode. Deliberately keeps the app navbar (a phone wants
 * log-out, theme and home), and gives the whole bottom of the screen to actions —
 * the board itself is on the television.
 *
 * The bottom bar is the shared `ActionBar`, which measures itself — this shell
 * used to reserve `pb-44` for a bar whose height its games actually decide.
 */
export function ControllerShell( {
	game,
	code,
	isMyTurn,
	waitingFor,
	deadline,
	completed,
	channelId,
	children,
	actions,
	persistentActions
}: ControllerShellProps ) {
	return (
		<div className={ "flex flex-col gap-3 items-center max-w-lg w-full" }>
			<div className={ "flex gap-2 items-center w-full rounded-md bg-background p-2" }>
				<Logo
					url={ `/logos/${ game.toLowerCase() }.svg` }
					classname={ "bg-foreground w-8 h-8 shrink-0" }
				/>
				<div className={ "flex-1 min-w-0" }>
					<p className={ "text-[10px] tracking-widest text-muted-foreground" }>CODE</p>
					<p className={ "text-lg font-heading leading-none truncate" }>{ code }</p>
				</div>
				<TurnTimer deadline={ completed ? undefined : deadline }/>
				{ !!channelId && <ChatPanel channelId={ channelId }/> }
			</div>

			{ children }

			{ !completed && (
				<ActionBar
					showActions={ isMyTurn }
					waitingFor={ waitingFor }
					persistentActions={ persistentActions }
				>
					{ actions }
				</ActionBar>
			) }
		</div>
	);
}
