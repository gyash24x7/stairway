import { Button } from "@/shared/ui/primitives/button.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { OpenTable } from "@/lobby/shared/schema.ts";

const MINUTE = 60_000;

/**
 * How long a table has been waiting, in the coarsest unit that is still true.
 *
 * `now` is passed in rather than read here so every row in one render agrees on
 * it, and so the list's own refresh is what moves the clock — a table's age has
 * no need of a timer of its own.
 *
 * @param createdAt - When the table was opened.
 * @param now - The reading the whole list is being rendered at.
 */
const formatAge = ( createdAt: number, now: number ) => {
	const elapsed = Math.max( 0, now - createdAt );

	if ( elapsed < MINUTE ) {
		return "just now";
	}

	const minutes = Math.floor( elapsed / MINUTE );
	return minutes < 60 ? `${ minutes }m ago` : `${ Math.floor( minutes / 60 ) }h ago`;
};

export type OpenTableRowProps = {
	table: OpenTable;
	/** What to call the game. */
	label: string;
	now: number;
	/**
	 * Take the seat, or absent when this client has no join endpoint for the kind —
	 * which is what a table of a game the worker has and the client has not looks
	 * like. Such a row still renders; it simply cannot be sat at.
	 */
	onJoin?: () => void;
	isJoining: boolean;
	disabled: boolean;
};

/**
 * One open table.
 *
 * Purely presentational — it neither queries nor navigates — so the list above it
 * can own the single in-flight join and every row can be disabled while it runs.
 *
 * The seats read twice over: as pips, which show the *shape* of the table at a
 * glance, and as a figure, which is the fact. On a narrow screen only the figure
 * survives.
 *
 * Exactly one control, never a clickable row wrapping a button — the same reason
 * the landing page's tiles keep their anchor and their contents apart.
 */
export function OpenTableRow( { table, label, now, onJoin, isJoining, disabled }: OpenTableRowProps ) {
	return (
		<div
			className={ cn(
				"flex items-center gap-3 px-3 py-2 border-t-2 border-outline",
				"flex-wrap md:flex-nowrap"
			) }
		>
			<span className={ "font-heading text-lg flex-1 min-w-0 truncate" }>
				{ label }
			</span>

			<span className={ "hidden md:block w-24 shrink-0 text-sm text-muted-foreground" }>
				{ table.code }
			</span>

			<div className={ "flex items-center gap-2 shrink-0" }>
				<div className={ "hidden md:flex gap-1" }>
					{ Array.from( { length: table.playerCount } ).map( ( _, seat ) => (
						<span
							key={ seat }
							className={ cn(
								"w-2.5 h-2.5 rounded-full border-2 border-outline",
								seat < table.seatsTaken ? "bg-accent" : "bg-surface"
							) }
						/>
					) ) }
				</div>
				<span className={ "font-heading text-lg tabular-nums w-12 text-right" }>
					{ `${ table.seatsTaken }/${ table.playerCount }` }
				</span>
			</div>

			<span className={ "hidden md:block w-20 shrink-0 text-right text-xs text-muted-foreground" }>
				{ formatAge( table.createdAt, now ) }
			</span>

			<Button size={ "sm" } onClick={ onJoin } disabled={ disabled || !onJoin }>
				{ isJoining ? "JOINING" : "JOIN" }
			</Button>
		</div>
	);
}
