import type { ReactNode } from "react";

import { Logo } from "@/shared/shell/logo";
import { ActionBar } from "@/swish/ui/action-bar";
import { TurnTimer } from "@/swish/ui/turn-timer";

export type ControllerShellProps = {
	game: string;
	isMyTurn: boolean;
	waitingFor?: string;
	deadline?: number;
	completed?: boolean;
	children: ReactNode;
	actions?: ReactNode;
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
	isMyTurn,
	waitingFor,
	deadline,
	completed,
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
				<TurnTimer deadline={ completed ? undefined : deadline }/>
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
