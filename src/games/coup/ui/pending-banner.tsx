import { cn } from "cn";
import { AnimatePresence, motion } from "framer-motion";

import type { CoupActionName, CoupPendingAction } from "@/games/coup/schema";
import type { Roster } from "@/swish/schema";
import { TurnTimer } from "@/swish/ui/turn-timer";


/** How each action reads once somebody has declared it. */
const ACTION_TEXT: Record<CoupActionName, string> = {
	income: "is taking 1 coin as Income",
	foreignAid: "is taking 2 coins as Foreign Aid",
	coup: "is launching a coup",
	tax: "is taking 3 coins as Tax",
	assassinate: "is assassinating",
	steal: "is stealing from",
	exchange: "is exchanging with the deck"
};

/** Which actions name somebody, so the sentence can end in a player rather than a stop. */
const AIMED: ReadonlyArray<CoupActionName> = [ "coup", "assassinate", "steal" ];

export type PendingBannerProps = {
	readonly pending?: CoupPendingAction;
	readonly players: Roster;
	/** When the open window closes, from the `GameView` envelope. */
	readonly deadline?: number;
};

/**
 * What the table is arguing about, in one sentence.
 *
 * Coup has no board, so this banner *is* the board: everything a player decides
 * — whether to challenge, whether to block, whether to believe any of it — is
 * decided from this line and the seats below it. It is deliberately phrased as
 * the claim rather than the effect, because a claim is the only thing that is
 * true yet: "Ravi claims DUKE" is what happened; taking three coins is what will
 * happen if nobody objects.
 *
 * Renders nothing when there is no open claim. Income and Coup never declare one
 * — nothing can be said about either, so there is nothing to hold open — which is
 * why the banner disappearing is itself meaningful.
 */
export function PendingBanner( { pending, players, deadline }: PendingBannerProps ) {
	return (
		<AnimatePresence mode={ "wait" } initial={ false }>
			{ !!pending && (
				<motion.div
					// Keyed on the claim, so a block landing on an existing action replays
					// the banner rather than quietly rewriting the sentence in place.
					key={ `${ pending.actor }-${ pending.action }-${ pending.blocker ?? "" }` }
					layout
					initial={ { opacity: 0, y: -8 } }
					animate={ { opacity: 1, y: 0 } }
					exit={ { opacity: 0, y: -8 } }
					className={ cn(
						"flex w-full flex-col gap-1 rounded-md border-2 border-outline",
						"bg-background p-3 text-center"
					) }
				>
					<div className={ "flex items-center justify-center gap-3" }>
						<p className={ "text-status" }>
							<span className={ "uppercase" }>
								{ players[ pending.actor ]?.name ?? "SOMEONE" }
							</span>
							{ ` ${ ACTION_TEXT[ pending.action ] }` }
							{ AIMED.includes( pending.action ) && !!pending.target && (
								<span className={ "uppercase" }>
									{ ` ${ players[ pending.target ]?.name ?? "SOMEONE" }` }
								</span>
							) }
						</p>
						<TurnTimer deadline={ deadline }/>
					</div>

					{ !!pending.claim && (
						<p className={ "text-xs text-muted-foreground" }>
							{ `Claiming ${ pending.claim } — nobody has checked` }
						</p>
					) }

					{ !pending.claim && !pending.blocker && (
						<p className={ "text-xs text-muted-foreground" }>
							{ "Claims nothing, so it cannot be challenged — only blocked by a Duke" }
						</p>
					) }

					{ !!pending.blocker && !!pending.blockClaim && (
						<p className={ "text-sm text-destructive" }>
							<span className={ "uppercase" }>
								{ players[ pending.blocker ]?.name ?? "SOMEONE" }
							</span>
							{ ` claims ${ pending.blockClaim } to block it` }
						</p>
					) }
				</motion.div>
			) }
		</AnimatePresence>
	);
}
