"use client";

import { useCoup } from "@/games/coup/client/context.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { LogEntry } from "@/games/coup/shared/schema.ts";

/**
 * How many lines of history to show. Coup turns are short and the interesting
 * part is always the last few, so this is a running commentary rather than an
 * archive — the full log rides the state either way.
 */
const RECENT = 8;

/**
 * Colours one line by what kind of thing happened.
 *
 * The entries carry structure rather than rendered strings precisely so this can
 * exist: a bluff being caught should not look like somebody taking income.
 */
const toneOf = ( entry: LogEntry ) => {
	if ( entry.note.startsWith( "caught the bluffed" ) ) {
		return "bg-red-500/15 dark:bg-red-500/25";
	}

	if ( entry.note.startsWith( "showed the" ) ) {
		return "bg-green-500/15 dark:bg-green-500/25";
	}

	if ( entry.note.startsWith( "lost the" ) || entry.note === "is out" ) {
		return "bg-neutral-dark/10 dark:bg-neutral-light/10";
	}

	if ( entry.note.startsWith( "blocks with" ) || entry.note.startsWith( "blocked with" ) ) {
		return "bg-blue-500/15 dark:bg-blue-500/25";
	}

	return "";
};

export function ActivityLog( props: { large?: boolean } ) {
	const { data } = useCoup();

	const recent = data.view.log.slice( -RECENT ).reverse();

	if ( recent.length === 0 ) {
		return null;
	}

	return (
		<div className={ "flex flex-col gap-1 w-full" }>
			<span className={ props.large ? "text-metric-label-lg" : "text-metric-label" }>
				WHAT HAPPENED
			</span>
			<div className={ "flex flex-col gap-1" }>
				{ recent.map( ( entry, at ) => (
					<div
						key={ `${ entry.turn }-${ at }-${ entry.note }` }
						className={ cn(
							"rounded-base px-3 py-1 border-2 border-outline/30",
							props.large ? "text-status-lg" : "text-status",
							// The newest line is the one being read; the rest is context.
							at === 0 ? "opacity-100" : "opacity-60",
							toneOf( entry )
						) }
					>
						<span className={ "font-heading text-accent" }>
							{ data.players[ entry.actor ]?.name ?? "someone" }
						</span>
						{ " " }
						<span>{ entry.note }</span>
						{ entry.target !== undefined && (
							<>
								{ " → " }
								<span className={ "font-heading" }>
									{ data.players[ entry.target ]?.name ?? "someone" }
								</span>
							</>
						) }
					</div>
				) ) }
			</div>
		</div>
	);
}
